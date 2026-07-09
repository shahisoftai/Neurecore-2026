import {
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { LocalDiskStorage } from '../../uploads/storage/local-disk.storage';
import type { IPortalRepository } from '../interfaces/portal.interface';
import type {
  PortalProject,
  PortalTokenPayload,
} from '../interfaces/portal.interface';
import type {
  RequestPortalAccessDto,
  ValidatePortalTokenDto,
  RefreshPortalTokenDto,
  UploadProjectDocumentDto,
  ApproveDeliverableDto,
} from '../dto/portal.dto';

export const PORTAL_REPOSITORY = 'PORTAL_REPOSITORY';

export const PORTAL_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @Inject(PORTAL_REPOSITORY)
    private readonly portalRepo: IPortalRepository,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storage: LocalDiskStorage,
  ) {}

  async requestAccess(
    dto: RequestPortalAccessDto,
  ): Promise<{ token: string; expiresIn: number }> {
    const contact = await this.prisma.customerContact.findFirst({
      where: {
        email: dto.email,
        customer: {
          projects: {
            some: { id: dto.projectId },
          },
        },
      },
      include: { customer: { select: { name: true } } },
    });

    if (!contact) {
      throw new NotFoundException(
        'No contact found with that email associated to this project.',
      );
    }

    const rawToken = await this.portalRepo.createPortalToken(
      contact.id,
      dto.projectId,
    );

    const expiresIn = PORTAL_TOKEN_TTL_SECONDS;

    // NOTE: In production this would email a magic link and the raw token would
    // never be returned in the API response. For local API clients we expose it
    // directly. The token hash is stored; only the raw token returned here can
    // be used to validate.
    return { token: rawToken, expiresIn };
  }

  async refreshToken(
    dto: RefreshPortalTokenDto,
  ): Promise<{ token: string; expiresIn: number }> {
    // Validate the current token first to ensure the requester already has access.
    const current = await this.validateToken({
      token: dto.token,
      projectId: dto.projectId,
    });

    // Mint a fresh token for the same contact + project.
    const rawToken = await this.portalRepo.createPortalToken(
      current.contactId,
      current.projectId,
    );

    this.logger.log(`Portal token refreshed for contact ${current.contactId}`);
    return { token: rawToken, expiresIn: PORTAL_TOKEN_TTL_SECONDS };
  }

  async unlinkDocument(
    projectId: string,
    contactId: string,
    documentId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        customer: {
          contacts: {
            some: { id: contactId },
          },
        },
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    const doc = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
    });

    if (!doc) {
      throw new NotFoundException('Document not found in this project');
    }

    if (doc.uploadedBy !== contactId) {
      throw new BadRequestException(
        'You can only unlink documents you uploaded',
      );
    }

    // Remove from storage (idempotent — ENOENT is fine)
    try {
      if (doc.fileKey) {
        await this.storage.delete(doc.fileKey);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete file from storage (key=${doc.fileKey}): ${String(err)}`,
      );
    }

    await this.prisma.projectDocument.delete({ where: { id: documentId } });
    this.logger.log(`Portal document ${documentId} unlinked by contact ${contactId}`);
  }

  async validateToken(
    dto: ValidatePortalTokenDto,
  ): Promise<PortalTokenPayload> {
    const parts = dto.token.split(':');
    if (parts.length !== 3) {
      throw new BadRequestException('Invalid portal token format');
    }

    const [projectId, contactId, rawToken] = parts;

    if (projectId !== dto.projectId) {
      throw new BadRequestException('Token project mismatch');
    }

    const contact = await this.portalRepo.validatePortalToken(
      contactId,
      rawToken,
    );

    if (!contact) {
      throw new UnauthorizedException('Invalid or expired portal token');
    }

    return {
      contactId,
      projectId,
      email: contact.email,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    };
  }

  async getProject(
    projectId: string,
    contactId: string,
  ): Promise<PortalProject> {
    const project = await this.portalRepo.findProjectForPortal(
      projectId,
      contactId,
    );

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    return project;
  }

  async uploadDocument(
    projectId: string,
    contactId: string,
    dto: UploadProjectDocumentDto,
    file: { buffer: Buffer; originalname: string; size: number; mimeType: string },
  ): Promise<{ id: string; name: string; fileUrl: string; createdAt: Date }> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        customer: {
          contacts: {
            some: { id: contactId },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    // Persist via the shared LocalDiskStorage (same backend as internal uploads)
    // so that portal documents are served by the existing CDN controller.
    const stored = await this.storage.put(
      contactId, // tenantId slot — using contactId ensures isolation by uploader
      'portal-documents',
      file.buffer,
      file.mimeType,
    );

    const doc = await this.prisma.projectDocument.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description ?? null,
        fileUrl: stored.url,
        fileKey: stored.key,
        fileSize: BigInt(file.size),
        mimeType: file.mimeType,
        visibility: dto.visibility ?? 'CLIENT',
        uploadedBy: contactId,
      },
    });

    return {
      id: doc.id,
      name: doc.name,
      fileUrl: doc.fileUrl,
      createdAt: doc.createdAt,
    };
  }

  async listDocuments(
    projectId: string,
    contactId: string,
    options: { skip?: number; take?: number; visibility?: string },
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        customer: {
          contacts: {
            some: { id: contactId },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    const where = {
      projectId,
      visibility: 'CLIENT' as const,
      ...(options.visibility ? { visibility: options.visibility } : {}),
    };

    const [documents, total] = await Promise.all([
      this.prisma.projectDocument.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.skip ?? 0,
        take: options.take ?? 20,
        select: {
          id: true,
          name: true,
          description: true,
          fileUrl: true,
          fileSize: true,
          mimeType: true,
          visibility: true,
          uploadedBy: true,
          createdAt: true,
        },
      }),
      this.prisma.projectDocument.count({ where }),
    ]);

    return {
      documents: documents.map((d) => ({
        ...d,
        fileSize: Number(d.fileSize),
      })),
      total,
      skip: options.skip ?? 0,
      take: options.take ?? 20,
    };
  }

  async approveDeliverable(
    projectId: string,
    deliverableId: string,
    contactId: string,
    dto: ApproveDeliverableDto,
  ): Promise<{ id: string; status: string }> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        customer: {
          contacts: {
            some: { id: contactId },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found or access denied');
    }

    const deliverable = await this.prisma.deliverable.findFirst({
      where: {
        id: deliverableId,
        projectId,
        clientFacing: true,
        status: 'IN_REVIEW',
      },
    });

    if (!deliverable) {
      throw new BadRequestException(
        'Deliverable not found, not client-facing, or not in review',
      );
    }

    const updated = await this.prisma.deliverable.update({
      where: { id: deliverableId },
      data: { status: 'APPROVED' },
      select: { id: true, status: true },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'deliverable.client_approved',
        actor: contactId,
        resource: 'deliverable',
        resourceId: deliverableId,
        details: { projectId, notes: dto.notes ?? null },
      },
    });

    return { id: updated.id, status: updated.status };
  }
}
