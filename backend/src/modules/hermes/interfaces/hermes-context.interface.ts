/**
 * hermes-context.interface.ts — Permission context contract for Hermes.
 *
 * NOTE: HermesExecutionContext and IHermesContext are defined in hermes-runtime.interface.ts.
 * This file adds PermissionContext used by PermissionMatrixService.
 *
 * SOLID — ISP: Focused solely on permission context shape.
 */

import type { UserRole, HermesAgentType } from '@prisma/client';

export interface PermissionContext {
    roles: UserRole[];
    hermesType: HermesAgentType;
    tenantId: string;
    workspaceId?: string;
    resource?: string;
    action: 'read' | 'write' | 'execute' | 'delete';
}
