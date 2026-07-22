import { TemplateType } from '@prisma/client';

export interface SeedTemplate {
  templateType: TemplateType;
  slug: string;
  name: string;
  description?: string;
  industrySlug: string;
  config: Record<string, unknown>;
}

export const FINANCIAL_COMPLIANCE_TEMPLATES: SeedTemplate[] = [
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'financial-client-lifecycle',
    name: 'Financial Services Client Lifecycle',
    description: 'Standard client lifecycle for financial services: prospect → KYC → active → dormant → closed',
    industrySlug: 'financial-services',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'kyc-verified', label: 'KYC Verified', order: 2 },
        { key: 'active', label: 'Active Account', order: 3 },
        { key: 'dormant', label: 'Dormant', order: 4 },
        { key: 'closed', label: 'Closed/Archived', order: 5 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        {
          key: 'clientType',
          label: 'Client Type',
          type: 'enum',
          options: ['Individual', 'Small Business', 'Enterprise'],
        },
        {
          key: 'amlRiskTier',
          label: 'AML Risk Tier',
          type: 'enum',
          options: ['Low', 'Medium', 'High'],
        },
        {
          key: 'kycStatus',
          label: 'KYC Status',
          type: 'enum',
          options: ['Pending', 'Verified', 'Expired'],
        },
        { key: 'taxId', label: 'Tax ID', type: 'encrypted' },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'accounting-client-lifecycle',
    name: 'Accounting Client Lifecycle',
    description: 'Client lifecycle for accounting firms: lead → proposal → engaged → active → complete → retained',
    industrySlug: 'accounting-audit-services',
    config: {
      stages: [
        { key: 'lead', label: 'Lead', order: 1 },
        { key: 'proposal-sent', label: 'Proposal Sent', order: 2 },
        { key: 'engaged', label: 'Engaged', order: 3 },
        { key: 'active', label: 'Active Client', order: 4 },
        { key: 'completed', label: 'Engagement Complete', order: 5 },
        { key: 'retained', label: 'Retained', order: 6 },
      ],
      defaultStage: 'lead',
      customerFieldDefinitions: [
        {
          key: 'clientType',
          label: 'Client Type',
          type: 'enum',
          options: ['Individual', 'SME', 'Corporate'],
        },
        {
          key: 'serviceType',
          label: 'Service Type',
          type: 'enum',
          options: ['Audit', 'Tax', 'Bookkeeping', 'Advisory'],
        },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'insurance-client-lifecycle',
    name: 'Insurance Client Lifecycle',
    description: 'Client lifecycle for insurance firms: lead → quote → policy-active → claim → renewal → lapsed',
    industrySlug: 'insurance',
    config: {
      stages: [
        { key: 'lead', label: 'Lead', order: 1 },
        { key: 'quote-sent', label: 'Quote Sent', order: 2 },
        { key: 'policy-active', label: 'Policy Active', order: 3 },
        { key: 'claim-in-progress', label: 'Claim In Progress', order: 4 },
        { key: 'renewal-due', label: 'Renewal Due', order: 5 },
        { key: 'lapsed', label: 'Lapsed', order: 6 },
      ],
      defaultStage: 'lead',
      customerFieldDefinitions: [
        {
          key: 'policyType',
          label: 'Policy Type',
          type: 'enum',
          options: ['Life', 'Health', 'Property', 'Auto', 'Liability'],
        },
        {
          key: 'riskTier',
          label: 'Risk Tier',
          type: 'enum',
          options: ['Preferred', 'Standard', 'Substandard'],
        },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'relationship-manager',
    name: 'Relationship Manager',
    description: 'Client relationship manager for financial services',
    industrySlug: 'financial-services',
    config: {
      systemPrompt: [
        'You are a Relationship Manager for a financial services firm.',
        'Your role: client communication, needs assessment, service requests, retention.',
        'Always maintain confidentiality. Follow KYC/AML procedures. Escalate suspicious activity.',
      ].join('\n'),
      kpis: [
        { name: 'Client satisfaction score', target: '4.5/5' },
        { name: 'Retention rate', target: '95%' },
        { name: 'Response time', target: '< 4 hours' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-officer',
    name: 'Compliance Officer',
    description: 'Compliance officer for financial services',
    industrySlug: 'financial-services',
    config: {
      systemPrompt: [
        'You are a Compliance Officer for a financial services firm.',
        'Your role: KYC/AML verification, document review, regulatory updates, compliance training.',
        'Ensure all client documentation is current. Flag non-compliant accounts. Track regulatory deadlines.',
      ].join('\n'),
      kpis: [
        { name: 'KYC verification rate', target: '98%' },
        { name: 'Compliance breaches prevented', target: '0' },
        { name: 'Audit readiness score', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'audit-manager',
    name: 'Audit Manager',
    description: 'Audit manager for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      systemPrompt: [
        'You are an Audit Manager for an accounting firm.',
        'Your role: audit planning, staffing, timeline management, stakeholder communication, quality review.',
        'Follow ISA standards. Ensure working papers are complete. Escalate material findings promptly.',
      ].join('\n'),
      kpis: [
        { name: 'Audit completion rate', target: '100% on time' },
        { name: 'Findings resolved', target: '90% within 30 days' },
        { name: 'Client satisfaction', target: '4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'tax-advisor',
    name: 'Tax Advisor',
    description: 'Tax advisor for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      systemPrompt: [
        'You are a Tax Advisor for an accounting firm.',
        'Your role: tax planning, compliance preparation, deduction optimization, regulatory monitoring.',
        'Stay current on tax law changes. Ensure accurate filing. Identify savings opportunities.',
      ].join('\n'),
      kpis: [
        { name: 'Tax filings on time', target: '100%' },
        { name: 'Tax savings identified', target: '> 5% YoY' },
        { name: 'Client satisfaction', target: '4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'insurance-underwriter',
    name: 'Insurance Underwriter',
    description: 'Insurance underwriter role',
    industrySlug: 'insurance',
    config: {
      systemPrompt: [
        'You are an Insurance Underwriter.',
        'Your role: risk assessment, policy pricing, claims evaluation, portfolio analysis.',
        'Follow underwriting guidelines. Maintain actuarial accuracy. Flag high-risk profiles.',
      ].join('\n'),
      kpis: [
        { name: 'Underwriting accuracy', target: '99%' },
        { name: 'Policy turnaround', target: '< 24 hours' },
        { name: 'Loss ratio', target: '< 65%' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-kyc-reminder',
    name: 'Daily KYC Document Reminder',
    description: 'Notify relationship managers about expiring KYC documents',
    industrySlug: 'financial-services',
    config: {
      trigger: 'time: 9:00 AM daily',
      action: 'Notify relationship manager for any client whose KYC expires within 30 days',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-compliance-digest',
    name: 'Weekly Compliance Digest',
    description: 'Weekly compliance summary for the compliance team',
    industrySlug: 'financial-services',
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Send compliance summary: KYC completions, pending verifications, upcoming regulatory deadlines',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-tax-deadline-check',
    name: 'Monthly Tax Deadline Check',
    description: 'Monthly check for upcoming tax filing deadlines',
    industrySlug: 'accounting-audit-services',
    config: {
      trigger: 'time: 1st of month 9:00 AM',
      action: 'List all clients with tax deadlines in the next 30 days and notify assigned tax advisors',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'policy-renewal-reminder',
    name: 'Policy Renewal Reminder',
    description: 'Remind agents about policies due for renewal',
    industrySlug: 'insurance',
    config: {
      trigger: 'time: daily 8:00 AM',
      action: 'List all policies expiring within 14 days and notify assigned agents',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'monthly-client-portfolio',
    name: 'Monthly Client Portfolio Report',
    description: 'Monthly client portfolio dashboard for financial services',
    industrySlug: 'financial-services',
    config: {
      metrics: [
        'totalClients',
        'activeClients',
        'kycComplianceRate',
        'pipelineValue',
      ],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'quarterly-audit-summary',
    name: 'Quarterly Audit Summary',
    description: 'Quarterly audit completion and findings summary',
    industrySlug: 'accounting-audit-services',
    config: {
      metrics: [
        'auditsCompleted',
        'findingsIdentified',
        'findingsResolved',
        'averageCompletionDays',
      ],
      period: 'quarterly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'claims-analytics',
    name: 'Claims Analytics Report',
    description: 'Insurance claims analytics dashboard',
    industrySlug: 'insurance',
    config: {
      metrics: [
        'claimsFiled',
        'claimsApproved',
        'claimsDenied',
        'averageProcessingDays',
        'totalPayoutAmount',
      ],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'kyc-document-collection',
    name: 'Collect KYC Documents',
    description: 'Standard KYC document collection workflow',
    industrySlug: 'financial-services',
    config: {
      description: 'Collect and verify client KYC documents: ID proof, address proof, source of funds',
      estimatedDuration: '2 days',
      assignToRole: 'compliance-officer',
      subtasks: [
        'Request ID proof from client',
        'Verify ID authenticity',
        'Collect address proof',
        'Document source of funds',
        'Mark KYC as verified',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'audit-planning',
    name: 'Audit Planning & Preparation',
    description: 'Standard audit planning workflow',
    industrySlug: 'accounting-audit-services',
    config: {
      description: 'Plan and prepare for client audit: scope definition, staffing, timeline, document requests',
      estimatedDuration: '5 days',
      assignToRole: 'audit-manager',
      subtasks: [
        'Define audit scope and objectives',
        'Assign audit team members',
        'Create audit timeline',
        'Send document request list to client',
        'Review previous audit findings',
        'Schedule kickoff meeting',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'claim-processing',
    name: 'Process Insurance Claim',
    description: 'Standard insurance claim processing workflow',
    industrySlug: 'insurance',
    config: {
      description: 'Process and evaluate an insurance claim: verification, assessment, approval, settlement',
      estimatedDuration: '10 days',
      assignToRole: 'insurance-underwriter',
      subtasks: [
        'Verify policy coverage',
        'Collect claim documentation',
        'Assess damage/liability',
        'Calculate settlement amount',
        'Obtain approval from senior underwriter',
        'Process payment',
        'Update claim records',
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'financial-dept-structure',
    name: 'Financial Services Department Structure',
    description: 'Default department structure for financial services firms',
    industrySlug: 'financial-services',
    config: {
      departments: [
        {
          name: 'Client Services',
          roles: ['Relationship Manager', 'Client Support'],
        },
        {
          name: 'Compliance',
          roles: ['Compliance Officer', 'Risk Analyst'],
        },
        {
          name: 'Operations',
          roles: ['Operations Specialist', 'Settlement Clerk'],
        },
        {
          name: 'Finance',
          roles: ['Finance Manager', 'Accountant'],
        },
        {
          name: 'Administration',
          roles: ['Office Manager', 'Executive Assistant'],
        },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'accounting-dept-structure',
    name: 'Accounting Firm Department Structure',
    description: 'Default department structure for accounting firms',
    industrySlug: 'accounting-audit-services',
    config: {
      departments: [
        { name: 'Audit', roles: ['Audit Manager', 'Senior Auditor', 'Staff Auditor'] },
        { name: 'Tax', roles: ['Tax Advisor', 'Tax Preparer'] },
        { name: 'Bookkeeping', roles: ['Bookkeeper', 'Payroll Specialist'] },
        {
          name: 'Advisory',
          roles: ['Financial Advisor', 'Business Consultant'],
        },
        {
          name: 'Administration',
          roles: ['Office Manager', 'Executive Assistant'],
        },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'insurance-dept-structure',
    name: 'Insurance Firm Department Structure',
    description: 'Default department structure for insurance firms',
    industrySlug: 'insurance',
    config: {
      departments: [
        {
          name: 'Underwriting',
          roles: ['Insurance Underwriter', 'Senior Underwriter'],
        },
        {
          name: 'Claims',
          roles: ['Claims Adjuster', 'Claims Processor'],
        },
        { name: 'Sales', roles: ['Insurance Agent', 'Broker'] },
        {
          name: 'Actuarial',
          roles: ['Actuary', 'Risk Analyst'],
        },
        {
          name: 'Administration',
          roles: ['Office Manager', 'Executive Assistant'],
        },
      ],
    },
  },
];
