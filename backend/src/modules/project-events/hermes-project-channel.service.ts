import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InterviewService } from '../information-engine/interview/interview.service';

@Injectable()
export class HermesProjectChannel {
  private readonly logger = new Logger(HermesProjectChannel.name);
  private readonly activeSessions = new Map<string, { sessionId: string; startedAt: Date }>();

  constructor(
    @Optional() private readonly interviewService?: InterviewService,
  ) {}

  async initiateDiscovery(projectId: string, tenantId: string): Promise<void> {
    if (!this.interviewService) {
      this.logger.warn(`InterviewService not available — skipping discovery for project ${projectId}`);
      return;
    }

    try {
      const session = this.activeSessions.get(projectId);
      if (session) {
        this.logger.debug(`Discovery session already active for project ${projectId}`);
        return;
      }

      const turn = await this.interviewService.askNext(projectId, tenantId, {});
      if (turn.question) {
        this.activeSessions.set(projectId, { sessionId: `disc-${projectId}-${Date.now()}`, startedAt: new Date() });
        this.logger.debug(`Discovery initiated for project ${projectId}: next question "${turn.question.id}"`);
      } else {
        this.logger.debug(`No more questions for project ${projectId} — discovery complete`);
      }
    } catch (err) {
      this.logger.error(`Failed to initiate discovery for project ${projectId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  getActiveSession(projectId: string): { sessionId: string; startedAt: Date } | undefined {
    return this.activeSessions.get(projectId);
  }

  endSession(projectId: string): void {
    this.activeSessions.delete(projectId);
    this.logger.debug(`Discovery session ended for project ${projectId}`);
  }
}
