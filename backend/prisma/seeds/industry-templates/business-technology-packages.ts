import { Package } from '@prisma/client';

interface PackageDef {
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

export const BUSINESS_TECHNOLOGY_PACKAGES: PackageDef[] = [
  { slug: 'it-project-delivery', name: 'IT Project Delivery', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'technology-digital-services', description: 'Core project delivery for IT consulting and digital agencies.', departments: ['Engineering', 'Administration'], agents: ['tech-project-manager', 'technical-lead', 'qa-engineer'], features: ['workflow_automation', 'audit_logs'] },
  { slug: 'it-devops-infrastructure', name: 'DevOps & Infrastructure', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'technology-digital-services', description: 'CI/CD pipelines, infrastructure management, and incident response.', departments: ['DevOps', 'Engineering'], agents: ['devops-specialist', 'technical-lead', 'qa-engineer'], features: ['workflow_automation', 'api_access', 'webhooks'] },
  { slug: 'it-client-success', name: 'Client Success & Support', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'technology-digital-services', description: 'Client relationship management, ticket handling, and SLA tracking.', departments: ['Client Success', 'Administration'], agents: ['client-success-manager', 'tech-project-manager'], features: ['crm_integration', 'workflow_automation'] },
  { slug: 'it-product-development', name: 'Product Development', scope: 'FUNCTIONAL', tierSlug: 'professional', industrySlug: 'technology-digital-services', description: 'End-to-end product development lifecycle from spec to launch.', departments: ['Engineering', 'Product', 'Quality Assurance'], agents: ['technical-lead', 'tech-project-manager', 'qa-engineer', 'devops-specialist'], features: ['workflow_automation', 'api_access', 'webhooks', 'audit_logs'] },
  { slug: 'professional-consulting', name: 'Professional Consulting', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'professional-business-services', description: 'Management consulting engagement delivery and client management.', departments: ['Consulting', 'Administration'], agents: ['engagement-manager', 'subject-matter-expert', 'research-specialist'], features: ['workflow_automation', 'crm_integration'] },
  { slug: 'professional-business-dev', name: 'Business Development', scope: 'FUNCTIONAL', tierSlug: 'starter', industrySlug: 'professional-business-services', description: 'Prospect qualification, proposal development, and pipeline management.', departments: ['Business Development', 'Operations'], agents: ['business-development', 'operations-coordinator'], features: ['crm_integration', 'workflow_automation'] },
  { slug: 'professional-legal', name: 'Legal Practice Management', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'professional-business-services', description: 'Legal matter tracking, document management, and compliance.', departments: ['Consulting', 'Administration'], agents: ['engagement-manager', 'subject-matter-expert', 'operations-coordinator'], features: ['workflow_automation', 'audit_logs', 'document_templates'] },
  { slug: 'professional-recruiting', name: 'Recruiting & Talent', scope: 'INDUSTRY', tierSlug: 'professional', industrySlug: 'professional-business-services', description: 'Recruiting assignments, candidate tracking, and placement management.', departments: ['Business Development', 'Operations'], agents: ['business-development', 'operations-coordinator', 'engagement-manager'], features: ['crm_integration', 'workflow_automation', 'api_access'] },
];