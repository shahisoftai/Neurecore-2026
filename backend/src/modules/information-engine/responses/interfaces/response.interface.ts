/**
 * Responses — Interfaces (Phase 2B)
 */

import type {
  InformationEntityType,
  InformationSourceType,
} from '../../common/types';

export const RESPONSE_REPOSITORY = 'RESPONSE_REPOSITORY';

export type InformationResponse = {
  id: string;
  entityType: InformationEntityType;
  entityId: string;
  questionId: string;
  value: unknown;
  sourceId: string;
  confidence: number;
  supersededById: string | null;
  createdAt: Date;
};

export type RecordResponseInput = {
  questionId: string;
  value: unknown;
  sourceType: InformationSourceType;
  sourceLabel: string;
  sourceRefType?: string | null;
  sourceRefId?: string | null;
  confidence?: number;
  verified?: boolean;
  /** When true, do NOT supersede any existing current response. Default false. */
  skipSupersede?: boolean;
};

export interface IResponseRepository {
  findCurrentByEntityAndQuestion(
    entityType: InformationEntityType,
    entityId: string,
    questionId: string,
  ): Promise<InformationResponse | null>;
  create(
    input: RecordResponseInput & {
      entityType: InformationEntityType;
      entityId: string;
      sourceId: string;
      confidence: number;
    },
  ): Promise<InformationResponse>;
  markSuperseded(responseId: string, newResponseId: string): Promise<void>;
  listCurrent(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<InformationResponse[]>;
  listHistory(
    entityType: InformationEntityType,
    entityId: string,
    questionId: string,
  ): Promise<InformationResponse[]>;
}

export interface IResponseService {
  record(
    entityType: InformationEntityType,
    entityId: string,
    dto: RecordResponseInput,
  ): Promise<InformationResponse>;
  listCurrent(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<InformationResponse[]>;
  listHistory(
    entityType: InformationEntityType,
    entityId: string,
    questionId: string,
  ): Promise<InformationResponse[]>;
}
