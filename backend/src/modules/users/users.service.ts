import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PasswordService } from '../auth/services/password.service';
import {
  CreateUserDto,
  UpdateUserDto,
  ChangePasswordDto,
} from './dto/user.dto';
import { UserRole, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async findAll(
    tenantId?: string,
    page = 1,
    limit = 20,
    search?: string,
    departmentId?: string,
  ) {
    const skip = (page - 1) * limit;

    const searchFilter: Prisma.UserWhereInput | undefined = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const where: Prisma.UserWhereInput = {};
    if (tenantId) where.tenantId = tenantId;
    if (departmentId) where.departmentId = departmentId;
    if (searchFilter) where.AND = [searchFilter];

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          departmentId: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findOne(id: string, tenantId?: string) {
    // CRITICAL: Filter by tenantId for tenant-level access
    const where: Prisma.UserWhereInput = { id };
    if (tenantId) {
      where.tenantId = tenantId;
    }

    const user = await this.prisma.user.findFirst({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        departmentId: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(dto: CreateUserDto) {
    // CRITICAL: Check email per tenant (tenant isolation)
    const whereClause: Prisma.UserWhereInput = { email: dto.email };
    if (dto.tenantId) {
      whereClause.tenantId = dto.tenantId;
    } else {
      // For platform-level users, check globally
      whereClause.tenantId = null;
    }

    const existing = await this.prisma.user.findFirst({
      where: whereClause,
    });
    if (existing)
      throw new ConflictException('Email already registered in this tenant');

    const passwordHash = await this.passwordService.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? UserRole.USER,
        tenantId: dto.tenantId ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
      },
    });

    this.logger.log(`User created: ${user.email}`);
    return user;
  }

  async update(id: string, dto: UpdateUserDto, tenantId?: string) {
    // First verify the user exists with proper tenant isolation
    await this.findOne(id, tenantId);

    // Build unique where clause with tenant filter for security
    const where: Prisma.UserWhereUniqueInput = { id };

    return this.prisma.user.update({
      where,
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        tenantId: true,
        isActive: true,
      },
    });
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);

const valid = await this.passwordService.compare(
      dto.currentPassword,
      user.passwordHash ?? '',
    );
    if (!valid)
      throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    this.logger.log(`Password changed for user: ${id}`);
    return { message: 'Password updated successfully' };
  }

async deactivate(id: string, tenantId?: string) {
    // First verify the user exists with proper tenant isolation
    await this.findOne(id, tenantId);

    // Build unique where clause
    const where: { id: string } = { id };

    return this.prisma.user.update({
      where,
      data: { isActive: false },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });
  }

  /**
   * Phase 2 — assign a user to a department (tenant-scoped).
   * Verifies user belongs to tenant AND department belongs to same tenant.
   */
  async assignToDepartment(userId: string, departmentId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found in tenant`);

    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true },
    });
    if (!dept) throw new NotFoundException(`Department ${departmentId} not found in tenant`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
      },
    });
  }

  /**
   * Phase 2 — unassign user from their current department.
   */
  async unassignFromDepartment(userId: string, tenantId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException(`User ${userId} not found in tenant`);

    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId: null },
      select: { id: true, departmentId: true },
    });
  }
}
