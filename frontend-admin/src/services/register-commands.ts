/**
 * registerAdminCommands — registers all admin portal navigation commands
 * O principle: extend here, never modify CommandPalette.
 */

import { commandRegistry } from './command-registry';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

export function registerAdminCommands(router: AppRouterInstance): () => void {
  const unregister = commandRegistry.registerMany([
    // ── Navigation ──────────────────────────────────────────────────────────
    {
      id: 'nav:overview',
      label: 'Go to Overview',
      group: 'Navigate',
      shortcut: 'G O',
      action: () => router.push('/overview'),
    },
    {
      id: 'nav:tenants',
      label: 'Go to Tenants',
      group: 'Navigate',
      shortcut: 'G T',
      action: () => router.push('/tenants'),
    },
    {
      id: 'nav:users',
      label: 'Go to Users',
      group: 'Navigate',
      action: () => router.push('/users'),
    },
    {
      id: 'nav:agents',
      label: 'Go to Agent Fleet',
      group: 'Navigate',
      shortcut: 'G A',
      action: () => router.push('/agents'),
    },
    {
      id: 'nav:models',
      label: 'Go to Models',
      group: 'Navigate',
      action: () => router.push('/models'),
    },
    {
      id: 'nav:monitoring',
      label: 'Go to Monitoring',
      group: 'Navigate',
      shortcut: 'G M',
      action: () => router.push('/monitoring'),
    },
    {
      id: 'nav:security',
      label: 'Go to Security',
      group: 'Navigate',
      action: () => router.push('/security'),
    },
    {
      id: 'nav:billing',
      label: 'Go to Billing',
      group: 'Navigate',
      action: () => router.push('/billing'),
    },
    {
      id: 'nav:connectors',
      label: 'Go to Connectors',
      group: 'Navigate',
      action: () => router.push('/connectors'),
    },
    {
      id: 'nav:audit',
      label: 'Go to Audit Logs',
      group: 'Navigate',
      shortcut: 'G L',
      action: () => router.push('/audit'),
    },
    {
      id: 'nav:brain',
      label: 'Go to Platform Brain Map',
      group: 'Navigate',
      shortcut: 'G B',
      action: () => router.push('/brain'),
    },
    {
      id: 'nav:strategy',
      label: 'Go to Strategy Room',
      group: 'Navigate',
      shortcut: 'G S',
      action: () => router.push('/strategy'),
    },

    // ── Actions ─────────────────────────────────────────────────────────────
    {
      id: 'action:new-tenant',
      label: 'Create New Tenant',
      group: 'Actions',
      shortcut: '⌘ N',
      action: () => router.push('/tenants'),
    },
  ]);

  return unregister;
}
