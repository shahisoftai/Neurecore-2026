import { SeedTemplate } from './financial-compliance-templates';

// The package seeding model from the implementation plan
// These are industry-composed packages that link departments, agents, and features
// For now they are defined as structured configs for future processing

export interface PackageSeedDef {
  slug: string;
  name: string;
  scope: 'FUNCTIONAL' | 'INDUSTRY';
  tierSlug: string;
  description: string;
  industrySlug: string;
  departments: string[];
  agents: string[];
  features: string[];
}

export const CONSUMER_COMMERCE_PACKAGES: PackageSeedDef[] = [
  { slug: 'retail-store-operations', name: 'Retail Store Operations', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'retail-commerce-consumer', description: 'Daily store operations, inventory, staffing, and cash reconciliation.', departments: ['Operations', 'Administration'], agents: ['operations-manager', 'customer-service-rep'], features: ['workflow_automation'] },
  { slug: 'retail-merchandising', name: 'Retail Merchandising', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'retail-commerce-consumer', description: 'Assortment planning, pricing strategy, and promotional management.', departments: ['Merchandising', 'Marketing', 'Analytics'], agents: ['merchandiser', 'marketing-manager', 'analytics-manager'], features: ['workflow_automation', 'crm_integration'] },
  { slug: 'retail-ecommerce', name: 'E-Commerce Operations', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'retail-commerce-consumer', description: 'Online store management, order fulfillment, and digital marketing.', departments: ['Marketing', 'Operations', 'Analytics'], agents: ['marketing-manager', 'operations-manager', 'analytics-manager'], features: ['api_access', 'webhooks', 'workflow_automation'] },
  { slug: 'retail-customer-loyalty', name: 'Customer Loyalty & Retention', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'retail-commerce-consumer', description: 'Loyalty program management, customer insights, and retention campaigns.', departments: ['Marketing', 'Customer Service', 'Analytics'], agents: ['marketing-manager', 'customer-service-rep', 'analytics-manager'], features: ['crm_integration', 'workflow_automation'] },
  { slug: 'media-content-production', name: 'Content Production Studio', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'media-communications-creative', description: 'Content campaign planning, production, and publishing workflow.', departments: ['Creative', 'Production'], agents: ['creative-director', 'content-producer', 'copywriter'], features: ['workflow_automation'] },
  { slug: 'media-brand-development', name: 'Brand Development & Strategy', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'media-communications-creative', description: 'Brand strategy, identity design, and creative direction.', departments: ['Creative', 'Client Services'], agents: ['creative-director', 'copywriter', 'project-manager-creative'], features: ['workflow_automation', 'document_templates'] },
  { slug: 'media-campaign-management', name: 'Campaign Management', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'media-communications-creative', description: 'Multi-channel campaign planning, media buying, and performance tracking.', departments: ['Media', 'Creative', 'Client Services'], agents: ['media-planner', 'content-producer', 'project-manager-creative'], features: ['api_access', 'workflow_automation', 'crm_integration'] },
  { slug: 'media-pr-communications', name: 'PR & Communications', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'media-communications-creative', description: 'Media relations, PR campaigns, and crisis communications.', departments: ['Media', 'Creative'], agents: ['media-planner', 'copywriter', 'project-manager-creative'], features: ['workflow_automation', 'crm_integration'] },
];

export const INDUSTRIAL_INFRA_PACKAGES: PackageSeedDef[] = [
  { slug: 'manufacturing-production', name: 'Manufacturing Production', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'manufacturing-industrial', description: 'Production scheduling, quality control, and shop floor management.', departments: ['Production', 'Quality', 'Maintenance'], agents: ['production-scheduler', 'quality-auditor', 'maintenance-coordinator'], features: ['workflow_automation'] },
  { slug: 'manufacturing-supply-chain', name: 'Manufacturing Supply Chain', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'manufacturing-industrial', description: 'Supplier management, inventory optimization, and procurement.', departments: ['Supply Chain', 'Production'], agents: ['supply-chain-manager', 'production-scheduler', 'quality-auditor'], features: ['api_access', 'workflow_automation'] },
  { slug: 'manufacturing-safety', name: 'Manufacturing Safety & Compliance', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'manufacturing-industrial', description: 'Safety compliance, incident tracking, and regulatory adherence.', departments: ['Safety', 'Quality', 'Administration'], agents: ['safety-officer', 'quality-auditor', 'maintenance-coordinator'], features: ['audit_logs', 'workflow_automation'] },
  { slug: 'construction-site-management', name: 'Construction Site Management', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'construction-engineering-infrastructure', description: 'Site operations, safety, subcontractor coordination, and progress tracking.', departments: ['Site Operations', 'Project Management'], agents: ['site-superintendent', 'construction-pm'], features: ['workflow_automation'] },
  { slug: 'construction-engineering', name: 'Construction Engineering', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'construction-engineering-infrastructure', description: 'Engineering design, permitting, inspections, and compliance.', departments: ['Engineering', 'Compliance', 'Project Management'], agents: ['civil-engineer', 'construction-pm', 'compliance-officer-construction'], features: ['audit_logs', 'workflow_automation', 'document_templates'] },
  { slug: 'energy-asset-management', name: 'Energy Asset Management', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'energy-utilities-natural-resources', description: 'Asset lifecycle tracking, maintenance planning, and replacement strategy.', departments: ['Asset Management', 'Field Operations'], agents: ['asset-manager-energy', 'technician-dispatcher', 'compliance-manager-energy'], features: ['api_access', 'workflow_automation', 'audit_logs'] },
  { slug: 'energy-outage-response', name: 'Energy Outage Response', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'energy-utilities-natural-resources', description: 'Outage detection, dispatch, restoration, and customer communication.', departments: ['Outage Management', 'Field Operations'], agents: ['outage-coordinator', 'technician-dispatcher', 'environmental-safety-officer'], features: ['workflow_automation', 'api_access'] },
  { slug: 'logistics-shipment', name: 'Logistics Shipment Management', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'logistics-transportation-supply-chain', description: 'Shipment booking, tracking, delivery confirmation, and exception handling.', departments: ['Operations', 'Transportation'], agents: ['shipment-coordinator', 'logistics-manager', 'logistics-customer-service'], features: ['api_access', 'workflow_automation'] },
  { slug: 'logistics-warehouse', name: 'Logistics Warehouse Operations', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'logistics-transportation-supply-chain', description: 'Receiving, inventory management, picking, packing, and shipping.', departments: ['Warehouse', 'Operations'], agents: ['warehouse-supervisor', 'logistics-manager', 'shipment-coordinator'], features: ['workflow_automation'] },
  { slug: 'logistics-fleet', name: 'Logistics Fleet Management', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'logistics-transportation-supply-chain', description: 'Fleet maintenance, route optimization, driver management, and fuel tracking.', departments: ['Transportation', 'Operations'], agents: ['logistics-manager', 'driver-operator', 'shipment-coordinator'], features: ['api_access', 'workflow_automation'] },
];

export const ALL_INDUSTRY_PACKAGES: PackageSeedDef[] = [
  ...CONSUMER_COMMERCE_PACKAGES,
  ...INDUSTRIAL_INFRA_PACKAGES,
];