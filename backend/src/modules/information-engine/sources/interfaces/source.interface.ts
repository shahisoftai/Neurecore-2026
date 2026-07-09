/**
 * Sources — Interfaces (Phase 2B)
 *
 * Following SOLID:
 * - Single Responsibility: only InformationSource contracts.
 * - Dependency Inversion: services depend on these abstractions.
 */

import type { InformationSourceType } from '../../common/types';

export const SOURCE_REPOSITORY = 'SOURCE_REPOSITORY';

export type InformationSource = {
  id: string;
  type: InformationSourceType;
  label: string;
  refType: string | null;
  refId: string | null;
  confidence: number;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

export type CreateSourceInput = {
  type: InformationSourceType;
  label: string;
  refType?: string | null;
  refId?: string | null;
  confidence: number;
};

export interface ISourceRepository {
  create(input: CreateSourceInput): Promise<InformationSource>;
  findById(id: string): Promise<InformationSource | null>;
  markVerified(id: string, actorId: string): Promise<InformationSource>;
}

export interface ISourceService {
  create(input: CreateSourceInput, actorId: string): Promise<InformationSource>;
  findById(id: string): Promise<InformationSource>;
  verify(id: string, actorId: string): Promise<InformationSource>;
}
