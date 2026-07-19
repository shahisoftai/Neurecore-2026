// ─── AdminSlashCommands.ts ─────────────────────────────────────────────────────
// SRP: Provides admin-scoped slash command definitions and suggestion matching.
// LSP-swappable with TenantSlashCommands (both implement ISlashCommandProvider).

import type { ISlashCommandProvider } from '@/core/services/interfaces/IChatService';
import type { SlashCommand } from '@/shared/types/chat.types';

export class AdminSlashCommands implements ISlashCommandProvider {
  readonly commands: SlashCommand[] = [
    {
      trigger: '/agents',
      label: 'Agent queries (platform-wide)',
      context: 'agent',
      suggestions: [
        'How many agents are running platform-wide?',
        'Which tenants have failing agents?',
        'Show agent error rate',
        'List paused agents',
      ],
    },
    {
      trigger: '/tenants',
      label: 'Tenant queries',
      context: 'tenant',
      suggestions: [
        'Which tenants are most active?',
        'Show tenants with anomalies',
        'List inactive tenants',
        'Which tenant costs the most?',
      ],
    },
    {
      trigger: '/billing',
      label: 'Billing queries',
      context: 'billing',
      suggestions: [
        'Platform revenue today',
        'Show cost by tenant',
        'Which tenants are unpaid?',
        'Show gross margin',
      ],
    },
    {
      trigger: '/system',
      label: 'System status',
      context: 'system',
      suggestions: [
        'What is the current error rate?',
        'Show service health',
        'Any active incidents?',
      ],
    },
    {
      trigger: '/feature-flags',
      label: 'Feature flags',
      context: 'system',
      suggestions: [
        'List enabled feature flags',
        'Show HERMES_ENABLED status',
        'Toggle a flag',
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
