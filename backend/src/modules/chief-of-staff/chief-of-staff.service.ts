import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MiniMaxClient } from '../models/services/minimax-client.service';
import { OfficialAgentGraph } from '../agents/langgraph/langgraph-official';
import { ProjectEventBus } from '../project-events/project-event-bus.service';
import { EventsGateway } from '../events/events.gateway';
import type { SendCosMessageDto, ProjectCosSnapshot } from './dto/cos.dto';

@Injectable()
export class ChiefOfStaffService {
  private readonly logger = new Logger(ChiefOfStaffService.name);
  private eventSubscriptions: Array<() => void> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly minimax: MiniMaxClient,
    @Optional() private readonly agentGraph?: OfficialAgentGraph,
    @Optional() private readonly eventBus?: ProjectEventBus,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  onModuleInit(): void {
    if (!this.eventBus) return;

    this.eventSubscriptions.push(
      this.eventBus.subscribe('TaskCompleted', (event) => {
        this.logger.debug(
          `CoS: Task completed on project ${event.projectId} — task: ${(event.payload as any)?.taskId}`,
        );
        const title = (event.payload as any)?.title ?? 'a task';
        void this.surfaceToHumans(event.projectId, event.tenantId, `Task completed: ${title}`);
      }),
      this.eventBus.subscribe('GoalAchieved', (event) => {
        const payload = event.payload as { title?: string };
        this.logger.debug(
          `CoS: Goal achieved on project ${event.projectId} — goal: ${(event.payload as any)?.goalId}`,
        );
        void this.surfaceToHumans(
          event.projectId,
          event.tenantId,
          `Goal achieved: ${payload?.title ?? 'milestone reached'}`,
        );
      }),
      this.eventBus.subscribe('StageCompleted', (event) => {
        this.logger.debug(
          `CoS: Stage completed on project ${event.projectId} — stage: ${(event.payload as any)?.stageName}`,
        );
        const stageName = (event.payload as any)?.stageName ?? 'a stage';
        void this.surfaceToHumans(event.projectId, event.tenantId, `Stage completed: ${stageName}`);
      }),
      this.eventBus.subscribe('HealthScoreDropped', (event) => {
        const p = event.payload as { score: number; previousScore: number; reason?: string };
        this.logger.warn(
          `CoS: Health dropped on project ${event.projectId} from ${p.previousScore} to ${p.score}`,
        );
        const reason = p.reason ? ` (${p.reason})` : '';
        void this.surfaceToHumans(
          event.projectId,
          event.tenantId,
          `⚠️ Health dropped from ${p.previousScore} to ${p.score}${reason}`,
        );
      }),
      this.eventBus.subscribe('InformationGapsFound', (event) => {
        const p = event.payload as { completenessScore: number; missingCount: number };
        this.logger.debug(
          `CoS: Information gaps found on project ${event.projectId} — ${p.missingCount} missing (${p.completenessScore}%)`,
        );
        void this.surfaceToHumans(
          event.projectId,
          event.tenantId,
          `${p.missingCount} information gaps detected (completeness ${p.completenessScore}%)`,
        );
      }),
    );

    this.logger.log('ChiefOfStaffService subscribed to project events');
  }

  private async surfaceToHumans(projectId: string, tenantId: string, message: string): Promise<void> {
    try {
      const humans = await this.prisma.projectMember.findMany({
        where: { projectId, actorType: 'HUMAN' },
        select: { actorId: true },
      });
      const payload = { projectId, message, timestamp: new Date().toISOString() };
      for (const human of humans) {
        this.eventsGateway?.emitToUser(human.actorId, 'cos:notification', payload);
      }
      this.eventsGateway?.emitToTenant(tenantId, 'cos:project_update', payload);
    } catch (err) {
      this.logger.warn(`Failed to surface CoS notification for ${projectId}: ${err}`);
    }
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.eventSubscriptions) {
      unsubscribe();
    }
    this.eventSubscriptions = [];
  }

  async sendMessage(
    projectId: string,
    tenantId: string,
    dto: SendCosMessageDto,
    userId: string = 'cos-user',
  ): Promise<{
    reply: string;
    conversationId: string;
    tokens?: { input: number; output: number; total: number };
    model?: string;
    provider?: string;
    projectSnapshot?: ProjectCosSnapshot;
  }> {
    const conversationId =
      dto.conversationId ?? `cos_${projectId}_${Date.now()}`;

    const snapshot = await this.fetchProjectSnapshot(projectId, tenantId);

    if (this.minimax.isConfigured() && this.agentGraph) {
      return this.chatWithAgent(projectId, tenantId, dto, conversationId, snapshot, userId);
    }

    return {
      reply: this.buildStubReply(snapshot),
      conversationId,
      projectSnapshot: snapshot,
      tokens: { input: 0, output: 0, total: 0 },
      model: 'stub',
      provider: 'none',
    };
  }

  private async chatWithAgent(
    projectId: string,
    tenantId: string,
    dto: SendCosMessageDto,
    conversationId: string,
    snapshot: ProjectCosSnapshot,
    userId: string,
  ): Promise<{
    reply: string;
    conversationId: string;
    tokens?: { input: number; output: number; total: number };
    model?: string;
    provider?: string;
    projectSnapshot?: ProjectCosSnapshot;
  }> {
    const intent = this.detectIntent(dto.message);

    if (intent === 'action') {
      try {
        const result = await this.agentGraph!.run({
          goal: dto.message,
          agentId: `cos-${projectId}`,
          tenantId,
          userId,
          sessionId: conversationId,
        });

        const messages = result.messages ?? [];
        const finalMessage = messages[messages.length - 1];
        const reply =
          finalMessage?.content ??
          (result.toolResults?.length > 0
            ? `Executed ${result.toolResults.length} action(s).`
            : 'Action completed.');

        return {
          reply,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: 'MiniMax-Text-01',
          provider: 'minimax',
          projectSnapshot: snapshot,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`CoS agent graph failed: ${msg}`);
        return {
          reply: `I attempted to execute that action but encountered an error: ${msg}`,
          conversationId,
          tokens: { input: 0, output: 0, total: 0 },
          model: 'MiniMax-Text-01',
          provider: 'minimax',
          projectSnapshot: snapshot,
        };
      }
    }

    const systemPrompt = this.buildCosSystemPrompt(snapshot);
    const historyText = (dto.history ?? [])
      .slice(-10)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    const prompt = [
      `SYSTEM: ${systemPrompt}`,
      `\nPROJECT DATA (JSON):\n${JSON.stringify(snapshot, null, 2)}`,
      historyText ? `\nCONVERSATION:\n${historyText}` : '',
      `\nUSER: ${dto.message}`,
      '\nASSISTANT:',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.minimax.invoke(prompt, 0.3, 512);
      const tokens = response.usage
        ? {
            input: response.usage.inputTokens,
            output: response.usage.outputTokens,
            total: response.usage.totalTokens,
          }
        : { input: 0, output: 0, total: 0 };

      return {
        reply: response.content,
        conversationId,
        tokens,
        model: this.minimax.model,
        provider: 'minimax',
        projectSnapshot: snapshot,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`CoS minimax failed: ${msg}`);
      return {
        reply: `I encountered an error: ${msg}`,
        conversationId,
        tokens: { input: 0, output: 0, total: 0 },
        model: this.minimax.model,
        provider: 'minimax',
        projectSnapshot: snapshot,
      };
    }
  }

  private async fetchProjectSnapshot(
    projectId: string,
    tenantId: string,
  ): Promise<ProjectCosSnapshot> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true, name: true, status: true },
    });

    const healthScore = await this.prisma.entityCompleteness
      .findFirst({
        where: { entityId: projectId, entityType: 'PROJECT' },
        select: { score: true },
      })
      .then((r) => r?.score ?? null);

    const [activeGoals, completedGoals, openTasks, completedTasks, currentStage, recentMemories] =
      await Promise.all([
        this.prisma.goal.count({
          where: { projectId, tenantId, status: 'ACTIVE' },
        }),
        this.prisma.goal.count({
          where: { projectId, tenantId, status: 'COMPLETED' },
        }),
        this.prisma.task.count({
          where: { projectId, tenantId, status: { not: 'COMPLETED' } },
        }),
        this.prisma.task.count({
          where: { projectId, tenantId, status: 'COMPLETED' },
        }),
        this.prisma.projectStage.findFirst({
          where: { projectId, status: { not: 'COMPLETED' } },
          orderBy: { order: 'asc' },
          select: { name: true },
        }),
        this.prisma.projectMemory.findMany({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { category: true, content: true, createdAt: true },
        }),
      ]);

    const completenessScore =
      healthScore ??
      (await this.prisma.entityCompleteness
        .findFirst({
          where: { entityId: projectId, entityType: 'PROJECT' },
        })
        .then((r) => r?.score ?? 0)) ?? 0;

    return {
      projectId,
      name: project?.name ?? 'Unknown',
      status: project?.status ?? 'UNKNOWN',
      healthScore,
      completenessScore,
      activeGoals,
      completedGoals,
      openTasks,
      completedTasks,
      currentStage: currentStage?.name ?? null,
      recentMemories: recentMemories.map((m) => ({
        category: m.category,
        content: m.content.slice(0, 200),
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  private buildCosSystemPrompt(snapshot: ProjectCosSnapshot): string {
    return `You are the Chief of Staff for project "${snapshot.name}" inside the NeureCore platform.
You are an elite executive AI assistant — part strategist, part analyst, part operator.
Your job is to help the human project owner make better decisions faster.

Your principles:
1. Answer ONLY using the PROJECT DATA provided below. Never hallucinate.
2. Be concise and direct — executives don't have time for filler.
3. Propose specific next actions when asked "what should I do?"
4. Surface risks proactively (budget, timeline, information gaps).
5. When you don't know, say so — do not guess.

Always format key numbers prominently.`;
  }

  private buildStubReply(snapshot: ProjectCosSnapshot): string {
    return `Chief of Staff is ready to assist with project "${snapshot.name}".
Status: ${snapshot.status} | Health: ${snapshot.healthScore ?? 'N/A'}% | Completeness: ${snapshot.completenessScore}%
Goals: ${snapshot.activeGoals} active / ${snapshot.completenessScore} completed
Tasks: ${snapshot.openTasks} open / ${snapshot.completedTasks} completed
Current Stage: ${snapshot.currentStage ?? 'N/A'}

MiniMax API key not configured — enable it in backend .env for full AI responses.`;
  }

  private detectIntent(message: string): 'action' | 'query' {
    const actionKeywords = [
      'create', 'add', 'new', 'make',
      'update', 'change', 'set',
      'delete', 'remove', 'archive',
      'assign', 'delegate', 'start', 'stop', 'pause',
      'complete', 'finish', 'submit',
    ];
    const lower = message.toLowerCase();
    return actionKeywords.some((k) => lower.includes(k)) ? 'action' : 'query';
  }
}
