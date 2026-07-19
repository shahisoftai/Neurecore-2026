// ─── TenantSlashCommands.ts ─────────────────────────────────────────────────────
// SRP: Provides tenant-scoped slash command definitions and suggestion matching.

import type { ISlashCommandProvider } from '@/core/services/interfaces/IChatService';
import type { SlashCommand } from '@/shared/types/chat.types';

export class TenantSlashCommands implements ISlashCommandProvider {
  readonly commands: SlashCommand[] = [
    {
      trigger: '/agents',
      label: 'Agent queries',
      context: 'agent',
      suggestions: [
        'How many agents are running?',
        'Which agents have high workload?',
        'Show me failed agents',
        'Pause all idle agents',
      ],
    },
    {
      trigger: '/tasks',
      label: 'Task queries',
      context: 'task',
      suggestions: [
        'How many tasks completed today?',
        'Which tasks failed this week?',
        'Assign a new task',
        'Show pending tasks',
      ],
    },
    {
      trigger: '/costs',
      label: 'Cost & budget',
      context: 'system',
      suggestions: [
        'What is my cost today?',
        'Which agent costs the most?',
        'Show cost breakdown',
        'Reduce expenses by 10%',
      ],
    },
    {
      trigger: '/workflows',
      label: 'Workflow queries',
      context: 'workflow',
      suggestions: [
        'List active workflows',
        'Which workflows failed?',
        'Show workflow execution history',
      ],
    },
    {
      trigger: '/approvals',
      label: 'Pending approvals',
      context: 'system',
      suggestions: [
        'What is pending approval?',
        'Show urgent approvals',
      ],
    },
  ];

  getSuggestions(input: string): SlashCommand[] {
    return this.commands.filter((c) => c.trigger.startsWith(input.toLowerCase()));
  }

  getContextForTrigger(input: string): string | undefined {
    return this.commands.find((c) => c.trigger === input.toLowerCase())?.context;
  }
}
