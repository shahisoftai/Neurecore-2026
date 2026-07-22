'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { IndustryStubPage } from '@/components/industry/IndustryStubPage';
import { tenantsService } from '@/services/tenants.service';
import { getIndustryNavConfig } from '@/lib/industryNavigation';

interface FeatureMeta {
  title: string;
  description: string;
  industryGroup: string;
  plannedPhase: string;
}

// plannedPhase is keyed by industry group. Stage 1 + 2 deliverables land in
// Phase 2; deferred stages use the matching plan document. Unknown groups
// fall back to "Future Phase".
const FEATURE_META_MAP: Record<string, FeatureMeta> = {
  engagements: { title: 'Engagements', description: 'Service delivery pipeline, billable hours, retainer status.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  loans: { title: 'Loans', description: 'Active loans, payment schedule, compliance status.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  portfolios: { title: 'Portfolios', description: 'Holdings dashboard, allocation view, performance tracking.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  audits: { title: 'Audits', description: 'Audit planning, fieldwork, reporting, follow-up tracking.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  tax: { title: 'Tax', description: 'Tax filing calendar, return status, e-signature workflow.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  payroll: { title: 'Payroll', description: 'Payroll processing, tax withholding, employee compensation.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  compliance: { title: 'Compliance', description: 'Compliance frameworks, controls, evidence collection, audit trails, regulatory reporting.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓ — checklist engine live)' },
  risk: { title: 'Risk', description: 'Portfolio risk metrics, concentration alerts, correlation analysis.', industryGroup: 'Financial & Compliance', plannedPhase: 'Phase 2 (Stage 2 ✓ — risk dashboards live)' },
  appointments: { title: 'Appointments', description: 'Calendar view, scheduling, no-show tracking.', industryGroup: 'Healthcare & Life Sciences', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  'medical-records': { title: 'Medical Records', description: 'Patient records, attachments, imaging, lab results.', industryGroup: 'Healthcare & Life Sciences', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  pharmacy: { title: 'Pharmacy', description: 'Prescription tracking, refill requests, inventory.', industryGroup: 'Healthcare & Life Sciences', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  laboratory: { title: 'Laboratory', description: 'Lab results dashboard, abnormality alerts, archiving.', industryGroup: 'Healthcare & Life Sciences', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  programs: { title: 'Programs', description: 'Program directory, status dashboard, KPI tracker.', industryGroup: 'Public & Social', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  grants: { title: 'Grants', description: 'Grant pipeline, proposal status, funding tracker, reporting calendar.', industryGroup: 'Public & Social', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  'field-operations': { title: 'Field Operations', description: 'Field site data, activity logs, beneficiary tracking.', industryGroup: 'Public & Social', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  cases: { title: 'Cases', description: 'Beneficiary case tracking, eligibility status, intervention history.', industryGroup: 'Public & Social', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  licenses: { title: 'Licenses', description: 'License applications, renewals, compliance status.', industryGroup: 'Public & Social', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  inspections: { title: 'Inspections', description: 'Inspection calendar, findings, corrective action, sign-off.', industryGroup: 'Public & Social', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  tickets: { title: 'Tickets', description: 'Support ticket queue, severity/SLA, resolution tracking.', industryGroup: 'Business & Technology', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  releases: { title: 'Releases', description: 'Release schedule, features in flight, deployment status.', industryGroup: 'Business & Technology', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  contracts: { title: 'Contracts', description: 'Contract terms, SLA terms, billing schedule, renewal dates.', industryGroup: 'Business & Technology', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  knowledge: { title: 'Knowledge Base', description: 'Internal documentation, architecture docs, runbooks.', industryGroup: 'Business & Technology', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  sites: { title: 'Sites', description: 'Project site dashboard, schedule, budget, progress tracking.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  production: { title: 'Production', description: 'Production schedule, line status, output tracking, quality metrics.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  'work-orders': { title: 'Work Orders', description: 'Maintenance queue, assignment, completion status, cost tracking.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  equipment: { title: 'Equipment', description: 'Asset inventory, maintenance history, uptime tracking, PM schedule.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  shipments: { title: 'Shipments', description: 'Active shipments, tracking, delivery status, billing.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  fleet: { title: 'Fleet', description: 'Vehicle inventory, location tracking, maintenance schedule, utilization.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  warehouses: { title: 'Warehouses', description: 'Location inventory, stock levels, receiving schedule, picking queue.', industryGroup: 'Industrial & Infrastructure', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  products: { title: 'Products', description: 'Product catalog, inventory levels, pricing, promotion status.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  orders: { title: 'Orders', description: 'Order pipeline, fulfillment status, returns tracking, customer service.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  inventory: { title: 'Inventory', description: 'Stock levels, reorder points, supplier performance, inventory turnover.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  stores: { title: 'Stores', description: 'Store performance dashboard, sales by store, inventory by location.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  promotions: { title: 'Promotions', description: 'Active promotions, discount tracking, ROI analysis, campaign calendar.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  campaigns: { title: 'Campaigns', description: 'Marketing campaigns, audience targeting, performance, budget tracking.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  content: { title: 'Content', description: 'Content calendar, production schedule, publishing pipeline, performance.', industryGroup: 'Consumer & Commerce', plannedPhase: 'Phase 2 (Stage 2 ✓)' },
  farms: { title: 'Farms', description: 'Farm directory, crop planning, soil conditions, yield tracking.', industryGroup: 'Agriculture & Food', plannedPhase: 'Stage 3 (not yet scheduled)' },
  fields: { title: 'Fields', description: 'Field directory, crop inventory, soil conditions, yield tracking.', industryGroup: 'Agriculture & Food', plannedPhase: 'Stage 3 (not yet scheduled)' },
  livestock: { title: 'Livestock', description: 'Herd management, health records, breeding program, production tracking.', industryGroup: 'Agriculture & Food', plannedPhase: 'Stage 3 (not yet scheduled)' },
  operations: { title: 'Operations', description: 'Inter-entity coordination, shared services, efficiency tracking.', industryGroup: 'Other', plannedPhase: 'Stage 3 (not yet scheduled)' },
  assets: { title: 'Assets', description: 'Asset inventory, portfolio oversight, performance tracking.', industryGroup: 'Other', plannedPhase: 'Stage 3 (not yet scheduled)' },
  documents: { title: 'Documents', description: 'Document library, indexing, versioning, governance records.', industryGroup: 'Other', plannedPhase: 'Stage 3 (not yet scheduled)' },
  custom: { title: 'Custom Modules', description: 'Custom industry modules and extensions.', industryGroup: 'Other', plannedPhase: 'Stage 3 (not yet scheduled)' },
};

export default function DynamicWorkspacePage() {
  const params = useParams();
  const feature = params.feature as string;
  const [tenantGroup, setTenantGroup] = useState<string | null>(null);

  useEffect(() => {
    tenantsService.getCurrent().then((t) => setTenantGroup(t.industryGroup)).catch(() => {});
  }, []);

  const meta = FEATURE_META_MAP[feature];
  if (meta) {
    return <IndustryStubPage title={meta.title} description={meta.description} industryGroup={meta.industryGroup} plannedPhase={meta.plannedPhase} />;
  }

  const navConfig = getIndustryNavConfig(tenantGroup);
  const extra = navConfig.workspaceExtras.find((e) => e.id === feature);

  const fallbackTitle = extra?.label ?? feature.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const fallbackGroup = tenantGroup
    ? tenantGroup.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Unknown';
  const fallbackPhase = extra ? 'Phase 2 (Stage 2 ✓ — extras shipped)' : 'Future Phase';

  return (
    <IndustryStubPage
      title={fallbackTitle}
      description={`${fallbackTitle} workspace module for ${fallbackGroup} industry group.`}
      industryGroup={fallbackGroup}
      plannedPhase={fallbackPhase}
    />
  );
}
