import { TemplateType } from '@prisma/client';

export const PUBLIC_SOCIAL_TEMPLATES: SeedTemplate[] = [
  // ═══ GOVERNMENT & PUBLIC SECTOR ═══
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'government-citizen-lifecycle',
    name: 'Government Citizen/Beneficiary Lifecycle',
    description: 'Citizen journey: applicant → approved beneficiary → active participant → completed/discharged → eligible for re-enrollment',
    industrySlug: 'government-public-sector',
    config: {
      stages: [
        { key: 'applicant', label: 'Applicant', order: 1 },
        { key: 'approved-beneficiary', label: 'Approved Beneficiary', order: 2 },
        { key: 'active-participant', label: 'Active Participant', order: 3 },
        { key: 'completed-discharged', label: 'Completed / Discharged', order: 4 },
        { key: 'eligible-reenrollment', label: 'Eligible for Re-enrollment', order: 5 },
      ],
      defaultStage: 'applicant',
      customerFieldDefinitions: [
        { key: 'programType', label: 'Program Type', type: 'enum', options: ['Benefits', 'Permits', 'Housing', 'Healthcare', 'Other'] },
        { key: 'eligibilityStatus', label: 'Eligibility Status', type: 'enum', options: ['Pending', 'Approved', 'Denied', 'Expired'] },
        { key: 'caseNumber', label: 'Case Number', type: 'text' },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'education-student-lifecycle',
    name: 'Education Student/Researcher Lifecycle',
    description: 'Student journey: applicant → enrolled → active → graduated/project complete → alumni/retained researcher',
    industrySlug: 'education-research',
    config: {
      stages: [
        { key: 'applicant', label: 'Applicant', order: 1 },
        { key: 'enrolled', label: 'Enrolled', order: 2 },
        { key: 'active', label: 'Active', order: 3 },
        { key: 'graduated', label: 'Graduated / Project Complete', order: 4 },
        { key: 'alumni', label: 'Alumni / Retained Researcher', order: 5 },
      ],
      defaultStage: 'applicant',
      customerFieldDefinitions: [
        { key: 'studentType', label: 'Type', type: 'enum', options: ['Undergraduate', 'Graduate', 'PhD', 'Postdoc', 'Researcher'] },
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'enrollmentYear', label: 'Enrollment Year', type: 'number' },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'nonprofit-beneficiary-lifecycle',
    name: 'Non-Profit Beneficiary/Donor/Volunteer Lifecycle',
    description: 'Stakeholder journey: prospective → active → engaged/retained → alumni/lapsed → re-engagement',
    industrySlug: 'nonprofit-international',
    config: {
      stages: [
        { key: 'prospective', label: 'Prospective', order: 1 },
        { key: 'active', label: 'Active Beneficiary / Volunteer / Donor', order: 2 },
        { key: 'engaged-retained', label: 'Engaged / Retained', order: 3 },
        { key: 'alumni-lapsed', label: 'Alumni / Lapsed', order: 4 },
        { key: 're-engagement', label: 'Re-engagement', order: 5 },
      ],
      defaultStage: 'prospective',
      customerFieldDefinitions: [
        { key: 'stakeholderType', label: 'Type', type: 'enum', options: ['Beneficiary', 'Donor', 'Volunteer', 'Partner', 'Staff'] },
        { key: 'engagementLevel', label: 'Engagement Level', type: 'enum', options: ['Low', 'Medium', 'High', 'Champion'] },
        { key: 'lastContactDate', label: 'Last Contact', type: 'date' },
      ],
    },
  },
  // ═══ AGENT ROLES — GOVERNMENT ═══
  {
    templateType: 'AGENT_ROLE',
    slug: 'program-manager-gov',
    name: 'Program Manager',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Program Manager for a government agency.\nYour role: program planning, budget tracking, stakeholder updates, performance monitoring.\nManage program lifecycle. Track KPIs. Ensure compliance with regulations. Report to oversight bodies.',
      kpis: [
        { name: 'Program milestones on track', target: '> 95%' },
        { name: 'Budget variance', target: '< 5%' },
        { name: 'Stakeholder satisfaction', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'caseworker-gov',
    name: 'Caseworker',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Caseworker for a government agency.\nYour role: beneficiary intake, eligibility verification, case updates, referral coordination.\nProcess applications fairly. Verify eligibility accurately. Maintain case documentation. Coordinate with partner agencies.',
      kpis: [
        { name: 'Application processing time', target: '< 30 days' },
        { name: 'Case accuracy', target: '> 99%' },
        { name: 'Beneficiary satisfaction', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-officer-gov',
    name: 'Compliance Officer',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Compliance Officer for a government agency.\nYour role: regulatory alignment, audit preparation, policy enforcement, risk management.\nMonitor regulatory changes. Prepare for audits. Enforce policies. Track compliance status.',
      kpis: [
        { name: 'Audit findings', target: '0 major' },
        { name: 'Policy compliance rate', target: '100%' },
        { name: 'Regulatory filing on time', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'procurement-specialist-gov',
    name: 'Procurement Specialist',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Procurement Specialist for a government agency.\nYour role: vendor selection, contract management, RFP processing, compliance.\nFollow procurement regulations. Run competitive processes. Evaluate bids. Manage contracts.',
      kpis: [
        { name: 'Procurement cycle time', target: '< 45 days' },
        { name: 'Cost savings vs budget', target: '> 5%' },
        { name: 'Contract compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'budget-analyst-gov',
    name: 'Budget Analyst',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Budget Analyst for a government agency.\nYour role: budget tracking, expense categorization, variance analysis, forecasting.\nMonitor spending. Analyze variances. Prepare budget reports. Support fiscal planning.',
      kpis: [
        { name: 'Budget reporting accuracy', target: '> 99%' },
        { name: 'Variance explanation rate', target: '100%' },
        { name: 'Report timeliness', target: '100% on deadline' },
      ],
    },
  },
  // ═══ AGENT ROLES — EDUCATION ═══
  {
    templateType: 'AGENT_ROLE',
    slug: 'academic-advisor',
    name: 'Academic Advisor',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are an Academic Advisor for an educational institution.\nYour role: student progress tracking, course planning, graduation readiness, mentorship.\nGuide students on academic paths. Monitor degree progress. Identify at-risk students. Recommend interventions.',
      kpis: [
        { name: 'Student retention rate', target: '> 90%' },
        { name: 'Graduation rate', target: '> 80% on time' },
        { name: 'Advising satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'research-coordinator',
    name: 'Research Coordinator',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are a Research Coordinator for an educational institution.\nYour role: experiment design support, data collection coordination, results tracking, compliance.\nSupport research projects. Coordinate data collection. Track milestones. Ensure IRB compliance.',
      kpis: [
        { name: 'Research milestones on track', target: '> 90%' },
        { name: 'IRB compliance', target: '100%' },
        { name: 'Publication output', target: 'Meeting targets' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'grant-administrator',
    name: 'Grant Administrator',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are a Grant Administrator for an educational institution.\nYour role: grant lifecycle management, compliance, reporting, budget management.\nTrack grant opportunities. Support proposal development. Manage post-award compliance. Submit reports on time.',
      kpis: [
        { name: 'Grant proposal submission rate', target: 'Meeting target' },
        { name: 'Award acceptance rate', target: '> 30%' },
        { name: 'Reporting compliance', target: '100% on time' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'admissions-officer',
    name: 'Admissions Officer',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are an Admissions Officer for an educational institution.\nYour role: application intake, verification, enrollment processing, communication.\nProcess applications efficiently. Verify credentials. Communicate decisions. Support enrollment.',
      kpis: [
        { name: 'Application processing time', target: '< 2 weeks' },
        { name: 'Enrollment yield', target: '> target rate' },
        { name: 'Applicant satisfaction', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'faculty-support-specialist',
    name: 'Faculty Support Specialist',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are a Faculty Support Specialist for an educational institution.\nYour role: course materials, grading support, student communications, administrative tasks.\nSupport faculty with course preparation. Manage learning management system. Coordinate student communications.',
      kpis: [
        { name: 'Course material readiness', target: '100% before start' },
        { name: 'Faculty satisfaction', target: '> 4.5/5' },
        { name: 'Response time', target: '< 24 hours' },
      ],
    },
  },
  // ═══ AGENT ROLES — NON-PROFIT ═══
  {
    templateType: 'AGENT_ROLE',
    slug: 'program-director-nonprofit',
    name: 'Program Director',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Program Director for a non-profit organization.\nYour role: program planning, delivery coordination, impact tracking, team leadership.\nDesign effective programs. Coordinate field delivery. Measure outcomes. Report to donors and board.',
      kpis: [
        { name: 'Program outcomes achieved', target: '> 90% of target' },
        { name: 'Cost per beneficiary', target: 'Within budget' },
        { name: 'Donor satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'grants-manager-nonprofit',
    name: 'Grants Manager',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Grants Manager for a non-profit organization.\nYour role: grant identification, proposal writing, compliance, reporting.\nResearch grant opportunities. Write compelling proposals. Manage post-award compliance. Submit timely reports.',
      kpis: [
        { name: 'Proposal submission rate', target: 'Meeting target' },
        { name: 'Grant win rate', target: '> 25%' },
        { name: 'Report submission on time', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'volunteer-coordinator',
    name: 'Volunteer Coordinator',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Volunteer Coordinator for a non-profit organization.\nYour role: recruitment, training, scheduling, hours tracking, recognition.\nAttract and retain volunteers. Match skills to needs. Track volunteer hours. Recognize contributions.',
      kpis: [
        { name: 'Volunteer retention rate', target: '> 75%' },
        { name: 'Volunteer hours delivered', target: 'Meeting target' },
        { name: 'Volunteer satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'donor-relations-manager',
    name: 'Donor Relations Manager',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Donor Relations Manager for a non-profit organization.\nYour role: prospect cultivation, gift documentation, donor communication, stewardship.\nIdentify and cultivate donors. Document gifts accurately. Communicate impact. Build long-term relationships.',
      kpis: [
        { name: 'Donor retention rate', target: '> 70%' },
        { name: 'Average gift size', target: 'Increasing YoY' },
        { name: 'Donor satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'impact-analyst',
    name: 'Impact Analyst',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are an Impact Analyst for a non-profit organization.\nYour role: data collection, outcomes measurement, impact report writing, evaluation.\nCollect program data systematically. Measure outcomes rigorously. Write compelling impact reports. Support program evaluation.',
      kpis: [
        { name: 'Data collection completeness', target: '> 95%' },
        { name: 'Report quality score', target: '> 4/5' },
        { name: 'Evaluation turnaround', target: '< 30 days' },
      ],
    },
  },
  // ═══ ROUTINES ═══
  {
    templateType: 'ROUTINE',
    slug: 'daily-application-review-gov',
    name: 'Daily Application Processing Review',
    industrySlug: 'government-public-sector',
    config: {
      trigger: 'time: 8:00 AM daily',
      action: 'Review all pending applications. Flag overdue cases. Assign new applications to caseworkers.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-budget-report-gov',
    name: 'Weekly Budget Status Report',
    industrySlug: 'government-public-sector',
    config: {
      trigger: 'time: Monday 9:00 AM',
      action: 'Generate weekly budget status: spending vs appropriation, variance analysis, upcoming obligations.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-student-check-in',
    name: 'Daily Student Progress Check-In',
    industrySlug: 'education-research',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Review at-risk students: attendance, grades, engagement. Flag students needing intervention.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-grant-deadline-check',
    name: 'Weekly Grant Deadline & Compliance Check',
    industrySlug: 'education-research',
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Review upcoming grant deadlines and reporting requirements. Flag urgent submissions due within 2 weeks.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-volunteer-reminder-nonprofit',
    name: 'Daily Volunteer Schedule Reminder',
    industrySlug: 'nonprofit-international',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Send reminders to volunteers scheduled for today. Confirm availability. Flag gaps for coordinator.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-donor-report-nonprofit',
    name: 'Monthly Donor Impact Report',
    industrySlug: 'nonprofit-international',
    config: {
      trigger: 'time: 5th of month 9:00 AM',
      action: 'Generate monthly donor impact summary: funds raised, programs funded, beneficiaries served. Send to major donors.',
      channels: ['in-app', 'email'],
    },
  },
  // ═══ REPORTS ═══
  {
    templateType: 'REPORT',
    slug: 'program-impact-dashboard',
    name: 'Program Impact Dashboard',
    industrySlug: 'government-public-sector',
    config: {
      metrics: ['beneficiariesServed', 'outcomesAchieved', 'costPerBeneficiary', 'processingTime', 'satisfactionScore'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'grant-compliance-report',
    name: 'Grant Compliance Report',
    industrySlug: 'education-research',
    config: {
      metrics: ['deadlinesMet', 'deliverablesOnTrack', 'budgetStatus', 'reportingCompliance', 'findingsResolved'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'student-progress-report',
    name: 'Student Progress & Retention Report',
    industrySlug: 'education-research',
    config: {
      metrics: ['enrollmentCount', 'retentionRate', 'graduationRate', 'averageGPA', 'atRiskCount'],
      period: 'quarterly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'donor-dashboard',
    name: 'Donor & Fundraising Dashboard',
    industrySlug: 'nonprofit-international',
    config: {
      metrics: ['totalRaised', 'donorCount', 'retentionRate', 'averageGift', 'costPerDollarRaised'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'volunteer-engagement-report',
    name: 'Volunteer Engagement Report',
    industrySlug: 'nonprofit-international',
    config: {
      metrics: ['volunteerCount', 'hoursContributed', 'retentionRate', 'satisfactionScore', 'programsSupported'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  // ═══ TASK TEMPLATES ═══
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'case-processing-gov',
    name: 'Beneficiary Case Processing',
    industrySlug: 'government-public-sector',
    config: {
      description: 'Process a beneficiary application: intake, verification, eligibility, decision, notification',
      estimatedDuration: '5 days',
      assignToRole: 'caseworker-gov',
      subtasks: [
        'Receive and log application',
        'Verify applicant identity and documents',
        'Check eligibility against program criteria',
        'Request additional information if needed',
        'Make eligibility determination',
        'Document decision and rationale',
        'Notify applicant of decision',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'rfp-processing-gov',
    name: 'RFP Processing & Vendor Selection',
    industrySlug: 'government-public-sector',
    config: {
      description: 'Process an RFP: drafting, publication, evaluation, award',
      estimatedDuration: '6 weeks',
      assignToRole: 'procurement-specialist-gov',
      subtasks: [
        'Define requirements and scope',
        'Draft RFP document',
        'Publish and advertise RFP',
        'Host pre-bid conference',
        'Evaluate proposals against criteria',
        'Select vendor and negotiate',
        'Award contract and notify bidders',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'course-development-edu',
    name: 'Course Development & Delivery',
    industrySlug: 'education-research',
    config: {
      description: 'Develop and deliver a new course: syllabus, materials, assessments, delivery',
      estimatedDuration: '4 weeks',
      assignToRole: 'faculty-support-specialist',
      subtasks: [
        'Define learning objectives',
        'Develop course syllabus',
        'Create lesson plans and materials',
        'Set up course in LMS',
        'Prepare assessments and rubrics',
        'Upload all materials',
        'Conduct course orientation',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'research-project-setup',
    name: 'Research Project Setup',
    industrySlug: 'education-research',
    config: {
      description: 'Set up a new research project: proposal, IRB, funding, team, timeline',
      estimatedDuration: '3 weeks',
      assignToRole: 'research-coordinator',
      subtasks: [
        'Draft research proposal and methodology',
        'Submit IRB application for approval',
        'Secure funding or grant allocation',
        'Assemble research team',
        'Set up data collection tools',
        'Create project timeline and milestones',
        'Schedule kickoff meeting',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'grant-proposal-nonprofit',
    name: 'Grant Proposal Development',
    industrySlug: 'nonprofit-international',
    config: {
      description: 'Develop and submit a grant proposal: research, writing, budget, submission',
      estimatedDuration: '3 weeks',
      assignToRole: 'grants-manager-nonprofit',
      subtasks: [
        'Research grant opportunity and requirements',
        'Develop project narrative and theory of change',
        'Create detailed program budget',
        'Gather required attachments and letters',
        'Internal review by program team',
        'Finalize and format proposal',
        'Submit before deadline',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'volunteer-onboarding',
    name: 'Volunteer Onboarding & Training',
    industrySlug: 'nonprofit-international',
    config: {
      description: 'Onboard and train a new volunteer: orientation, screening, training, placement',
      estimatedDuration: '1 week',
      assignToRole: 'volunteer-coordinator',
      subtasks: [
        'Review volunteer application and skills',
        'Conduct background check if required',
        'Schedule orientation session',
        'Provide organization overview and policies',
        'Deliver role-specific training',
        'Assign to program and supervisor',
        'Set up volunteer schedule',
      ],
    },
  },
  // ═══ DEPARTMENT STRUCTURES ═══
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'government-dept-structure',
    name: 'Government Agency Department Structure',
    industrySlug: 'government-public-sector',
    config: {
      departments: [
        { name: 'Programs', roles: ['Program Manager', 'Caseworker', 'Program Coordinator'] },
        { name: 'Compliance & Legal', roles: ['Compliance Officer', 'Legal Counsel', 'Policy Analyst'] },
        { name: 'Procurement', roles: ['Procurement Specialist', 'Contract Manager'] },
        { name: 'Finance', roles: ['Budget Analyst', 'Accountant', 'Financial Manager'] },
        { name: 'Information Technology', roles: ['IT Manager', 'Systems Administrator'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'education-dept-structure',
    name: 'Educational Institution Department Structure',
    industrySlug: 'education-research',
    config: {
      departments: [
        { name: 'Academic Affairs', roles: ['Academic Advisor', 'Faculty Support Specialist', 'Curriculum Developer'] },
        { name: 'Research', roles: ['Research Coordinator', 'Grant Administrator', 'Lab Manager'] },
        { name: 'Admissions', roles: ['Admissions Officer', 'Recruiter', 'Enrollment Specialist'] },
        { name: 'Student Services', roles: ['Student Counselor', 'Career Advisor', 'Registrar'] },
        { name: 'Information Technology', roles: ['IT Manager', 'LMS Administrator'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'nonprofit-dept-structure',
    name: 'Non-Profit Organization Department Structure',
    industrySlug: 'nonprofit-international',
    config: {
      departments: [
        { name: 'Programs', roles: ['Program Director', 'Project Manager', 'Field Officer'] },
        { name: 'Development & Fundraising', roles: ['Grants Manager', 'Donor Relations Manager', 'Fundraising Coordinator'] },
        { name: 'Volunteer Management', roles: ['Volunteer Coordinator', 'Volunteer Trainer'] },
        { name: 'Monitoring & Evaluation', roles: ['Impact Analyst', 'M&E Officer', 'Data Collector'] },
        { name: 'Communications', roles: ['Communications Manager', 'Content Creator', 'Social Media Manager'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
];

export interface SeedTemplate {
  templateType: TemplateType;
  slug: string;
  name: string;
  description?: string;
  industrySlug: string;
  config: Record<string, unknown>;
}
