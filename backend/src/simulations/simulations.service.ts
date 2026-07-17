import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';

export interface CreateSimulationDto {
  tenantId: string;
  name: string;
  seed: string;
  orgSlug: string;       // part of the URI
  framework: string;      // part of the URI
  versions: any;          // the version block (validated by caller)
  engineConfig: any;
  customerId?: string;
  parentProjectId?: string;
  retentionDays?: number;
}

export interface SimulationUriParts {
  orgSlug: string;
  framework: string;
  seq: number;
}

/**
 * SimulationsService — Phase 1 (Simulation-5).
 *
 * A simulation run is represented as a Project with metadata.simulation.
 * The simulationId URI is `sim://YYYY/MM/DD/<orgSlug>/<framework>/<seq>`.
 * The seq is allocated transactionally to prevent two concurrent calls
 * from receiving the same URI.
 */
@Injectable()
export class SimulationsService {
  private readonly logger = new Logger(SimulationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute today's date in YYYY/MM/DD format (UTC).
   */
  private todayDatePath(now: Date = new Date()): string {
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  /**
   * Compute the next sequence number for a (orgSlug, framework, date) tuple.
   * Uses a Postgres sequence per tuple for transactional allocation.
   */
  private async nextSequence(orgSlug: string, framework: string, datePath: string): Promise<number> {
    const seqName = `sim_seq_${orgSlug.replace(/[^a-z0-9]/g, '_')}_${framework.replace(/[^a-z0-9]/g, '_')}_${datePath.replace(/[^0-9]/g, '_')}`;
    // Idempotent CREATE SEQUENCE IF NOT EXISTS
    await this.prisma.$executeRawUnsafe(
      `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1 INCREMENT 1`,
    );
    const rows: Array<{ nextval: bigint }> = await this.prisma.$queryRawUnsafe(
      `SELECT nextval('"${seqName}"') AS nextval`,
    );
    return Number(rows[0].nextval);
  }

  /**
   * Validate the simulationId URI format.
   */
  private validateSimulationUri(uri: string): boolean {
    return /^sim:\/\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9][a-z0-9-]{1,62}\/[a-z0-9][a-z0-9-]{1,62}\/\d{6}$/.test(uri);
  }

  async create(dto: CreateSimulationDto) {
    const datePath = this.todayDatePath();
    const orgSlug = dto.orgSlug;
    const framework = dto.framework;

    // Allocate sequence inside a transaction so concurrent calls don't collide
    return this.prisma.$transaction(async (tx) => {
      // Create sequence if not exists (idempotent)
      const seqName = `sim_seq_${orgSlug.replace(/[^a-z0-9]/g, '_')}_${framework.replace(/[^a-z0-9]/g, '_')}_${datePath.replace(/[^0-9]/g, '_')}`;
      await tx.$executeRawUnsafe(
        `CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1 INCREMENT 1`,
      );
      const seqRows: Array<{ nextval: bigint }> = await tx.$queryRawUnsafe(
        `SELECT nextval('"${seqName}"') AS nextval`,
      );
      const seq = Number(seqRows[0].nextval);
      const seqPadded = String(seq).padStart(6, '0');
      const simulationId = `sim://${datePath}/${orgSlug}/${framework}/${seqPadded}`;

      if (!this.validateSimulationUri(simulationId)) {
        throw new BadRequestException({
          code: 'INVALID_SIMULATION_ID',
          message: `Generated simulationId failed validation: ${simulationId}`,
        });
      }

      const project = await tx.project.create({
        data: {
          tenantId: dto.tenantId,
          name: dto.name,
          description: `Simulation-5 run ${simulationId}`,
          status: 'ACTIVE',
          priority: 'URGENT',
          customerId: dto.customerId,
          parentProjectId: dto.parentProjectId,
          budgetAmount: 850000,
          budgetCurrency: 'USD',
          tags: ['simulation', 'simulation-5', 'aeic', `seed:${dto.seed}`],
          metadata: {
            simulation: {
              simulationId,
              seed: dto.seed,
              rng: { algorithm: 'xoshiro256**', version: '1.0.0' },
              framework: { name: framework, version: dto.versions.framework },
              versions: dto.versions,
              engineConfig: dto.engineConfig,
              currentDay: 0,
              currentPhase: 'init',
              checkpoints: [],
              retentionDays: dto.retentionDays ?? 90,
              scoringVersion: dto.versions.scoring,
            },
          },
        },
      });

      // Create the master control thread
      const controlThread = await tx.communicationThread.create({
        data: {
          tenantId: dto.tenantId,
          title: `Simulation-5 Control: ${simulationId}`,
          contextType: 'Project',
          contextId: project.id,
          status: 'ACTIVE',
          simulationId,
          envelopeKind: 'simulation_control',
        },
      });

      return {
        simulationId,
        simulationRunId: project.id,
        projectId: project.id,
        controlThreadId: controlThread.id,
        status: 'PENDING' as const,
        currentDay: 0,
        versions: dto.versions,
        createdAt: project.createdAt.toISOString(),
      };
    });
  }

  async get(tenantId: string, simulationId: string) {
    const project = await this.prisma.project.findFirst({
      where: { tenantId, metadata: { path: ['simulation', 'simulationId'], equals: simulationId } },
    });
    if (!project) throw new NotFoundException({ code: 'SIMULATION_NOT_FOUND' });
    const meta = (project.metadata as any)?.simulation ?? {};
    return {
      simulationId: meta.simulationId,
      simulationRunId: project.id,
      projectId: project.id,
      controlThreadId: '', // could look up; omitted for brevity
      status: project.status,
      currentDay: meta.currentDay ?? 0,
      seed: meta.seed,
      versions: meta.versions,
      engineConfig: meta.engineConfig,
      startedAt: project.createdAt.toISOString(),
      completedAt: meta.completedAt ?? null,
      retentionDays: meta.retentionDays ?? 90,
      scores: meta.scores ?? null,
    };
  }

  async list(tenantId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        tenantId,
        tags: { has: 'simulation-5' },
      },
      orderBy: { createdAt: 'desc' },
    });
    return {
      items: projects.map((p) => {
        const meta = (p.metadata as any)?.simulation ?? {};
        return {
          simulationId: meta.simulationId,
          simulationRunId: p.id,
          projectId: p.id,
          status: p.status,
          currentDay: meta.currentDay ?? 0,
          createdAt: p.createdAt.toISOString(),
        };
      }),
    };
  }

  /**
   * Helper: parse a simulationId URI into its parts.
   */
  parseSimulationId(uri: string): SimulationUriParts | null {
    const m = uri.match(/^sim:\/\/(\d{4})\/(\d{2})\/(\d{2})\/([a-z0-9][a-z0-9-]{1,62})\/([a-z0-9][a-z0-9-]{1,62})\/(\d{6})$/);
    if (!m) return null;
    return { orgSlug: m[4], framework: m[5], seq: parseInt(m[6], 10) };
  }

  /**
   * Helper: find the project for a simulationId (within a tenant).
   */
  async findProjectBySimulationId(tenantId: string, simulationId: string) {
    if (!this.validateSimulationUri(simulationId)) {
      throw new BadRequestException({
        code: 'INVALID_SIMULATION_ID',
        message: `simulationId does not match expected format: ${simulationId}`,
      });
    }
    const project = await this.prisma.project.findFirst({
      where: {
        tenantId,
        metadata: { path: ['simulation', 'simulationId'], equals: simulationId },
      },
    });
    if (!project) {
      throw new NotFoundException({
        code: 'SIMULATION_NOT_FOUND',
        message: 'Simulation not found for this tenant. (Cross-tenant access returns 404, not 403.)',
      });
    }
    return project;
  }
}