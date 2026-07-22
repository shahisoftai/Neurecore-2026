'use client';

import { TemplateManager } from '@/components/templates/TemplateManager';

export default function TemplatesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your tenant templates for customer lifecycles, agent roles, routines, reports, tasks, and departments.
        </p>
      </div>
      <TemplateManager />
    </div>
  );
}
