import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * DecisionEvaluationsService — Phase 1 (Simulation-5).
 *
 * DecisionEvaluations are IMMUTABLE. Once written, they can never be updated.
 * The DB trigger rejects UPDATE statements.
 *
 * To "update" a score, create a new DecisionEvaluation row with a new
 * evaluationKind (e.g. RETROSPECTIVE) and a new scoringVersion if the
 * rules changed. ProjectDecision.latestEvaluationId is updated atomically
 * to point at the new evaluation.
 */
@Injectable()
export class DecisionEvaluationsService {
  private readonly logger = new Logger(DecisionEvaluationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    tenantId: string;
    decisionId: string;
    simulationId?: string;
    evaluationKind: any;
    scoringVersion: string;
    scores: any;
    evaluatorKind: any;
    evaluatorId?: string;
    notes?: string;
    metadata?: any;
  }) {
    if (!/^[a-z0-9.-]+$/.test(params.scoringVersion)) {
      throw new BadRequestException({
        code: 'INVALID_SCORING_VERSION',
        message: 'scoringVersion must match /^[a-z0-9.-]+$/ (e.g. v1, v1.2.3).',
      });
    }
    const decision = await this.prisma.projectDecision.findFirst({
      where: {
        id: params.decisionId,
        project: { tenantId: params.tenantId },
      },
    });
    if (!decision) {
      throw new NotFoundException({
        code: 'DECISION_NOT_FOUND',
        message: 'Decision not found for this tenant.',
      });
    }

    // Create the evaluation, then atomically update the decision's pointer.
    // We use a transaction so the latestEvaluationId and the evaluation row
    // are consistent.
    return this.prisma.$transaction(async (tx) => {
      const evalRow = await tx.decisionEvaluation.create({
        data: {
          tenantId: params.tenantId,
          decisionId: params.decisionId,
          simulationId: params.simulationId,
          evaluationKind: params.evaluationKind,
          scoringVersion: params.scoringVersion,
          scores: params.scores,
          evaluatorKind: params.evaluatorKind,
          evaluatorId: params.evaluatorId,
          notes: params.notes,
          metadata: params.metadata ?? {},
        },
      });
      await tx.projectDecision.update({
        where: { id: params.decisionId },
        data: { latestEvaluationId: evalRow.id },
      });
      return evalRow;
    });
  }

  async listForDecision(decisionId: string, tenantId: string) {
    return this.prisma.decisionEvaluation.findMany({
      where: { decisionId, tenantId },
      orderBy: { evaluatedAt: 'desc' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const found = await this.prisma.decisionEvaluation.findFirst({
      where: { id, tenantId },
    });
    if (!found) throw new NotFoundException({ code: 'DECISION_EVALUATION_NOT_FOUND' });
    return found;
  }

  async getLatestForDecision(decisionId: string, tenantId: string) {
    return this.prisma.decisionEvaluation.findFirst({
      where: { decisionId, tenantId },
      orderBy: { evaluatedAt: 'desc' },
    });
  }
}