/**
 * Responses — Prisma Repository (Phase 2B)
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IResponseRepository,
  InformationResponse,
  RecordResponseInput,
} from '../interfaces/response.interface';
import type { InformationEntityType } from '../../common/types';

@Injectable()
export class PrismaResponseRepository implements IResponseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrentByEntityAndQuestion(
    entityType: InformationEntityType,
    entityId: string,
    questionId: string,
  ): Promise<InformationResponse | null> {
    const found = await this.prisma.informationResponse.findFirst({
      where: {
        entityType: entityType,
        entityId,
        questionId,
        supersededById: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    return found ? mapToResponse(found) : null;
  }

  async create(
    input: RecordResponseInput & {
      entityType: InformationEntityType;
      entityId: string;
      sourceId: string;
      confidence: number;
    },
  ): Promise<InformationResponse> {
    const created = await this.prisma.informationResponse.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        questionId: input.questionId,
        value: input.value as Prisma.InputJsonValue,
        sourceId: input.sourceId,
        confidence: input.confidence,
      },
    });
    return mapToResponse(created);
  }

  async markSuperseded(
    responseId: string,
    newResponseId: string,
  ): Promise<void> {
    await this.prisma.informationResponse.update({
      where: { id: responseId },
      data: { supersededById: newResponseId },
    });
  }

  async listCurrent(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<InformationResponse[]> {
    const items = await this.prisma.informationResponse.findMany({
      where: {
        entityType: entityType,
        entityId,
        supersededById: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    return items.map(mapToResponse);
  }

  async listHistory(
    entityType: InformationEntityType,
    entityId: string,
    questionId: string,
  ): Promise<InformationResponse[]> {
    const items = await this.prisma.informationResponse.findMany({
      where: {
        entityType: entityType,
        entityId,
        questionId,
      },
      orderBy: { createdAt: 'asc' },
    });
    return items.map(mapToResponse);
  }
}

function mapToResponse(raw: {
  id: string;
  entityType: string;
  entityId: string;
  questionId: string;
  value: unknown;
  sourceId: string;
  confidence: number;
  supersededById: string | null;
  createdAt: Date;
}): InformationResponse {
  return {
    id: raw.id,
    entityType: raw.entityType as InformationResponse['entityType'],
    entityId: raw.entityId,
    questionId: raw.questionId,
    value: raw.value,
    sourceId: raw.sourceId,
    confidence: raw.confidence,
    supersededById: raw.supersededById,
    createdAt: raw.createdAt,
  };
}
