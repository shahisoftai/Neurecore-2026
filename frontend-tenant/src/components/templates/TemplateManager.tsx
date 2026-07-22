'use client';

import { useState } from 'react';
import {
  type TemplateType,
  TEMPLATE_TYPE_LABELS,
} from '@/services/tenant-templates.service';
import { TemplateList } from './TemplateList';

const TAB_ORDER: TemplateType[] = [
  'CUSTOMER_LIFECYCLE',
  'AGENT_ROLE',
  'ROUTINE',
  'REPORT',
  'TASK_TEMPLATE',
  'DEPARTMENT_DEFAULT',
];

export function TemplateManager() {
  const [activeTab, setActiveTab] = useState<TemplateType>('AGENT_ROLE');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TAB_ORDER.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {TEMPLATE_TYPE_LABELS[tab]}
          </button>
        ))}
      </div>

      <TemplateList templateType={activeTab} />
    </div>
  );
}
