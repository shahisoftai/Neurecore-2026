import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';
import type {
  IPermissionMatrix,
  PermissionCheckContext,
  PermissionMatrixRow,
  GrantPermissionInput,
  RevokePermissionInput,
} from '../interfaces/permission-matrix.interface';
import type {
  HermesAgentType,
  ToolPermissionLevel,
  UserRole,
} from '@prisma/client';

interface InMemoryPolicyEntry {
  hermesType: HermesAgentType;
  role: UserRole;
  toolPattern: string;
  level: ToolPermissionLevel;
}

const DEFAULT_POLICY: InMemoryPolicyEntry[] = [
  { hermesType: 'HR', role: 'USER', toolPattern: 'email', level: 'ALLOW' },
  { hermesType: 'HR', role: 'USER', toolPattern: 'tasks', level: 'ALLOW' },
  {
    hermesType: 'HR',
    role: 'USER',
    toolPattern: 'documents',
    level: 'READ_ONLY',
  },
  { hermesType: 'HR', role: 'USER', toolPattern: 'finance', level: 'DENY' },
  { hermesType: 'FINANCE', role: 'USER', toolPattern: 'erp', level: 'ALLOW' },
  {
    hermesType: 'FINANCE',
    role: 'USER',
    toolPattern: 'invoices',
    level: 'ALLOW',
  },
  {
    hermesType: 'FINANCE',
    role: 'USER',
    toolPattern: 'payments',
    level: 'ALLOW',
  },
  {
    hermesType: 'FINANCE',
    role: 'USER',
    toolPattern: 'hr_system',
    level: 'DENY',
  },
  { hermesType: 'SALES', role: 'USER', toolPattern: 'crm', level: 'ALLOW' },
  { hermesType: 'SALES', role: 'USER', toolPattern: 'email', level: 'ALLOW' },
  { hermesType: 'SALES', role: 'USER', toolPattern: 'finance', level: 'DENY' },
  { hermesType: 'CUSTOM', role: 'USER', toolPattern: 'email', level: 'ALLOW' },
  {
    hermesType: 'CUSTOM',
    role: 'USER',
    toolPattern: 'documents',
    level: 'READ_ONLY',
  },
];

@Injectable()
export class PermissionMatrixService implements IPermissionMatrix {
  private readonly logger = new Logger(PermissionMatrixService.name);
  private readonly tenantOverrides = new Map<
    string,
    Map<string, ToolPermissionLevel>
  >();
  private readonly cache = new Map<
    string,
    { overrides: Map<string, ToolPermissionLevel>; expires: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async can(context: PermissionCheckContext): Promise<boolean> {
    const { hermesType, toolName, roles, tenantId } = context;

    const override = this.getOverride(tenantId, hermesType, roles, toolName);
    if (override !== null) {
      return override !== 'DENY';
    }

    const defaultEntry = DEFAULT_POLICY.find(
      (p) =>
        (p.hermesType === hermesType || p.hermesType === 'CUSTOM') &&
        roles.includes(p.role) &&
        (p.toolPattern === '*' || toolName.includes(p.toolPattern)),
    );

    if (defaultEntry) {
      return defaultEntry.level !== 'DENY';
    }

    return false;
  }

  async getAllowedTools(
    hermesType: HermesAgentType,
    roles: UserRole[],
    tenantId: string,
  ): Promise<string[]> {
    const allowed = new Set<string>();
    const overrides = this.getTenantOverrides(tenantId);

    for (const [key, level] of overrides) {
      const parts = key.split(':');
      const entryHermesType = parts[0] as HermesAgentType;
      const entryRoles = parts[1]?.split(',') as UserRole[];
      const toolPattern = parts[2];

      if (entryHermesType !== hermesType) continue;
      if (!entryRoles?.some((r) => roles.includes(r))) continue;

      if (level === 'DENY') {
        allowed.delete(toolPattern);
      } else {
        allowed.add(toolPattern);
      }
    }

    for (const p of DEFAULT_POLICY) {
      if (p.hermesType !== hermesType && p.hermesType !== 'CUSTOM') continue;
      if (!roles.includes(p.role)) continue;
      if (p.toolPattern === '*') return ['*'];
      if (p.level !== 'DENY') allowed.add(p.toolPattern);
    }

    return Array.from(allowed);
  }

  async grant(input: GrantPermissionInput): Promise<void> {
    const key = `${input.hermesType}:${input.role}:${input.toolName}`;
    if (!this.tenantOverrides.has(input.tenantId)) {
      this.tenantOverrides.set(input.tenantId, new Map());
    }
    this.tenantOverrides.get(input.tenantId)!.set(key, input.level);
    this.cache.delete(input.tenantId);
    this.logger.log(
      `[PermissionMatrix] Granted ${input.level} on ${input.toolName} for ${input.hermesType}/${input.role}`,
    );
  }

  async revoke(input: RevokePermissionInput): Promise<void> {
    const key = `${input.hermesType}:${input.role}:${input.toolName}`;
    this.tenantOverrides.get(input.tenantId)?.delete(key);
    this.cache.delete(input.tenantId);
    this.logger.log(
      `[PermissionMatrix] Revoked permission on ${input.toolName} for ${input.hermesType}/${input.role}`,
    );
  }

  async getMatrix(tenantId: string): Promise<PermissionMatrixRow[]> {
    const rows: PermissionMatrixRow[] = [];
    const overrides = this.getTenantOverrides(tenantId);

    for (const [key, level] of overrides) {
      const [hermesType, roleStr, toolName] = key.split(':');
      rows.push({
        id: key,
        hermesType: hermesType as HermesAgentType,
        role: roleStr as UserRole,
        toolName,
        level,
        conditions: {},
        tenantId,
      });
    }

    return rows;
  }

  getDefaults(): PermissionMatrixRow[] {
    return DEFAULT_POLICY.map((p, i) => ({
      id: `default:${i}`,
      hermesType: p.hermesType,
      role: p.role,
      toolName: p.toolPattern,
      level: p.level,
      conditions: {},
    }));
  }

  private getOverride(
    tenantId: string,
    hermesType: HermesAgentType,
    roles: UserRole[],
    toolName: string,
  ): ToolPermissionLevel | null {
    const overrides = this.getTenantOverrides(tenantId);
    for (const role of roles) {
      const exactKey = `${hermesType}:${role}:${toolName}`;
      if (overrides.has(exactKey)) return overrides.get(exactKey)!;
      const wildcardKey = `${hermesType}:${role}:*`;
      if (overrides.has(wildcardKey)) return overrides.get(wildcardKey)!;
    }
    return null;
  }

  private getTenantOverrides(
    tenantId: string,
  ): Map<string, ToolPermissionLevel> {
    const cached = this.cache.get(tenantId);
    if (cached && cached.expires > Date.now()) {
      return cached.overrides;
    }
    const overrides = this.tenantOverrides.get(tenantId) ?? new Map();
    this.cache.set(tenantId, { overrides, expires: Date.now() + 60_000 });
    return overrides;
  }
}
