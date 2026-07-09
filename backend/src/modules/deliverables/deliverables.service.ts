/**
 * Deliverables Service
 *
 * Phase 3: Goals + Tasks → Deliverables
 * SOLID: Single responsibility — owns Deliverable + Version lifecycle only.
 *
 * Phase 2F: `submit` triggers an InformationEngine `recompute` so the
 * project-level completeness score reflects the new submission.
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import type {
  IDeliverableRepository,
  Deliverable,
  DeliverableVersion,
  CreateDeliverableInput,
  UpdateDeliverableInput,
  CreateDeliverableVersionInput,
  ListDeliverablesOptions,
} from './interfaces/deliverable.interface';
import { DELIVERABLE_REPOSITORY } from './interfaces/deliverable.interface';
import type { ContinuousDiscoveryService } from '../information-engine/cron/continuous-discovery.service';

export const DELIVERABLES_SERVICE = 'DELIVERABLES_SERVICE';

@Injectable()
export class DeliverablesService {
  private readonly logger = new Logger(DeliverablesService.name);

  constructor(
    @Inject(DELIVERABLE_REPOSITORY)
    private readonly repo: IDeliverableRepository,
    @Optional()
    private readonly continuousDiscovery?: ContinuousDiscoveryService,
  ) {}

  async create(tenantId: string, dto: CreateDeliverableInput): Promise<Deliverable> {
    return this.repo.create(dto);
  }

  async findById(id: string, tenantId: string): Promise<Deliverable> {
    const found = await this.repo.findById(id, tenantId);
    if (!found) throw new NotFoundException(`Deliverable ${id} not found`);
    return found;
  }

  async findAll(
    tenantId: string,
    opts: ListDeliverablesOptions = {},
  ): Promise<{ data: Deliverable[]; total: number }> {
    return this.repo.findAll(opts, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateDeliverableInput,
  ): Promise<Deliverable> {
    return this.repo.update(id, tenantId, dto);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    return this.repo.delete(id, tenantId);
  }

  // ─── Version operations ───────────────────────────────────────────────────

  /**
   * Create a new immutable version of a deliverable.
   * Versions are append-only — no update/delete on versions.
   */
  async createVersion(
    deliverableId: string,
    tenantId: string,
    dto: CreateDeliverableVersionInput,
  ): Promise<DeliverableVersion> {
    const deliverable = await this.repo.findById(deliverableId, tenantId);
    if (!deliverable) {
      throw new NotFoundException(`Deliverable ${deliverableId} not found`);
    }
    return this.repo.createVersion(deliverableId, dto);
  }

  async findVersions(
    deliverableId: string,
    tenantId: string,
  ): Promise<DeliverableVersion[]> {
    const deliverable = await this.repo.findById(deliverableId, tenantId);
    if (!deliverable) {
      throw new NotFoundException(`Deliverable ${deliverableId} not found`);
    }
    return this.repo.findVersionsByDeliverableId(deliverableId);
  }

  async getLatestVersion(
    deliverableId: string,
    tenantId: string,
  ): Promise<DeliverableVersion | null> {
    const deliverable = await this.repo.findById(deliverableId, tenantId);
    if (!deliverable) {
      throw new NotFoundException(`Deliverable ${deliverableId} not found`);
    }
    return this.repo.getLatestVersion(deliverableId);
  }

  // ─── Phase 2F: Submission ───────────────────────────────────────────────

  /**
   * Mark a deliverable as submitted. The deliverable must belong to a
   * project — we recompute that project's completeness so the score
   * reflects the new submission.
   *
   * The submit-state transition itself (DRAFT → SUBMITTED) is recorded by
   * the underlying repository implementation; the engine's only concern
   * is the recompute side effect.
   */
  async submit(id: string, tenantId: string): Promise<Deliverable> {
    const existing = await this.repo.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Deliverable ${id} not found`);
    }
    if (!existing.projectId) {
      throw new BadRequestException(
        `Deliverable ${id} is not attached to a project`,
      );
    }
    // Move the deliverable into IN_REVIEW (the closest "submitted" state
    // in the existing DeliverableStatus enum: DRAFT → IN_REVIEW → APPROVED/REJECTED).
    const updated = await this.repo.update(id, tenantId, {
      status: 'IN_REVIEW',
    } as UpdateDeliverableInput);

    if (this.continuousDiscovery) {
      void this.continuousDiscovery.onDeliverableSubmitted(existing.projectId);
    }
    return updated;
  }
}
