#!/usr/bin/env node
/**
 * seed-public-social-templates.cjs
 *
 * Stage 1 Phase 1A — Seeds system-level tenant templates (tenantId = null)
 * for Government & Public Sector, Education & Research, and Nonprofit & International industries.
 *
 * IDEMPOTENT: upsert keyed on (tenantId=null, slug, templateType).
 * Safe to run multiple times.
 *
 * Run: node prisma/seed-public-social-templates.cjs
 *
 * Flags:
 *   --check      Dry run; prints what would be seeded without writing.
 *   --verbose    Log every row.
 *
 * Reads DATABASE_URL from backend/.env.production (falls back to .env).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.production');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--check') || process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const TEMPLATES = [
  // ──────────────────────────────────────────────
  // GOVERNMENT & PUBLIC SECTOR (11 templates)
  // ──────────────────────────────────────────────
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'government-citizen-lifecycle',
    name: 'Government Citizen Lifecycle',
    description: 'Standard citizen lifecycle for government services: applicant → approved beneficiary → active participant → completed/discharged → eligible for re-enrollment',
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
    templateType: 'AGENT_ROLE',
    slug: 'program-manager-gov',
    name: 'Program Manager (Government)',
    description: 'Government program manager responsible for planning, budget oversight, stakeholder coordination, and program performance',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Government Program Manager.\nYour role: program planning, budget oversight, stakeholder coordination, performance monitoring.\nEnsure alignment with policy objectives. Track milestones and deliverables. Report to senior leadership.',
      kpis: [
        { name: 'Milestones on track', target: '> 95%' },
        { name: 'Budget variance', target: '< 5%' },
        { name: 'Stakeholder satisfaction', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'caseworker-gov',
    name: 'Caseworker (Government)',
    description: 'Government caseworker handling citizen intake, eligibility verification, case management, and referrals',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Government Caseworker.\nYour role: citizen intake, eligibility verification, case updates, referrals to partner agencies.\nMaintain complete and accurate case files. Follow data privacy regulations. Ensure timely processing.',
      kpis: [
        { name: 'Case processing time', target: '< 30 days' },
        { name: 'Data accuracy rate', target: '> 99%' },
        { name: 'Citizen satisfaction', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-officer-gov',
    name: 'Compliance Officer (Government)',
    description: 'Government compliance officer responsible for regulatory oversight, audit preparation, policy enforcement, and risk management',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Government Compliance Officer.\nYour role: regulatory interpretation, audit preparation, policy enforcement, risk assessment.\nStay current on legislative changes. Ensure all programs follow statutory requirements. Prepare for external audits.',
      kpis: [
        { name: 'Major audit findings', target: '0' },
        { name: 'Policy compliance rate', target: '100%' },
        { name: 'Regulatory filings on time', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'procurement-specialist-gov',
    name: 'Procurement Specialist (Government)',
    description: 'Government procurement specialist managing vendor selection, RFP processes, contract administration, and procurement compliance',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Government Procurement Specialist.\nYour role: vendor selection, RFP drafting and management, contract negotiation, procurement compliance.\nFollow public procurement regulations. Ensure fair competition. Document all procurement decisions.',
      kpis: [
        { name: 'Procurement cycle time', target: '< 45 days' },
        { name: 'Cost savings achieved', target: '> 5%' },
        { name: 'Contract compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'budget-analyst-gov',
    name: 'Budget Analyst (Government)',
    description: 'Government budget analyst tracking expenditures, performing variance analysis, forecasting, and ensuring fiscal compliance',
    industrySlug: 'government-public-sector',
    config: {
      systemPrompt: 'You are a Government Budget Analyst.\nYour role: budget tracking, expense categorization, variance analysis, fiscal forecasting.\nEnsure appropriations are not exceeded. Identify cost-saving opportunities. Prepare budget reports for oversight bodies.',
      kpis: [
        { name: 'Budget tracking accuracy', target: '> 99%' },
        { name: 'Variance explanations', target: '100%' },
        { name: 'Reports submitted on deadline', target: '100%' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-application-review-gov',
    name: 'Daily Application Review (Government)',
    description: 'Daily review of all pending citizen applications with flagging of overdue cases and assignment of new cases',
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
    name: 'Weekly Budget Report (Government)',
    description: 'Weekly budget status report covering spending vs appropriation, variance analysis, and upcoming obligations',
    industrySlug: 'government-public-sector',
    config: {
      trigger: 'time: Monday 9:00 AM',
      action: 'Generate weekly budget status: spending vs appropriation, variance analysis, upcoming obligations.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'program-impact-dashboard',
    name: 'Program Impact Dashboard',
    description: 'Monthly dashboard tracking government program impact metrics including beneficiaries served, outcomes, cost efficiency, processing time, and satisfaction',
    industrySlug: 'government-public-sector',
    config: {
      metrics: ['beneficiariesServed', 'outcomesAchieved', 'costPerBeneficiary', 'processingTime', 'satisfactionScore'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'case-processing-gov',
    name: 'Process Beneficiary Case (Government)',
    description: 'Standard government case processing workflow from intake to notification',
    industrySlug: 'government-public-sector',
    config: {
      description: 'Process a beneficiary application from initial intake through verification, eligibility determination, documentation, and notification',
      estimatedDuration: '5 days',
      assignToRole: 'caseworker-gov',
      subtasks: [
        'Receive application and create case file',
        'Verify applicant identity and documentation',
        'Check eligibility against program criteria',
        'Request additional information if needed',
        'Determine eligibility and benefit level',
        'Document decision and rationale',
        'Notify applicant of determination',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'rfp-processing-gov',
    name: 'Process RFP (Government)',
    description: 'Standard government RFP processing workflow from requirements definition to contract award',
    industrySlug: 'government-public-sector',
    config: {
      description: 'Process a Request for Proposal from requirements definition through drafting, publication, evaluation, and contract award',
      estimatedDuration: '6 weeks',
      assignToRole: 'procurement-specialist-gov',
      subtasks: [
        'Define procurement requirements and scope',
        'Draft RFP document and evaluation criteria',
        'Publish RFP and manage vendor communications',
        'Conduct pre-proposal conference',
        'Evaluate proposals against criteria',
        'Select vendor and negotiate terms',
        'Award contract and notify participants',
      ],
    },
  },

  // ──────────────────────────────────────────────
  // EDUCATION & RESEARCH (12 templates)
  // ──────────────────────────────────────────────
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'education-student-lifecycle',
    name: 'Education Student Lifecycle',
    description: 'Standard student lifecycle for educational institutions: applicant → enrolled → active → graduated → alumni',
    industrySlug: 'education-research',
    config: {
      stages: [
        { key: 'applicant', label: 'Applicant', order: 1 },
        { key: 'enrolled', label: 'Enrolled', order: 2 },
        { key: 'active', label: 'Active Student', order: 3 },
        { key: 'graduated', label: 'Graduated', order: 4 },
        { key: 'alumni', label: 'Alumni', order: 5 },
      ],
      defaultStage: 'applicant',
      customerFieldDefinitions: [
        { key: 'studentType', label: 'Student Type', type: 'enum', options: ['Undergraduate', 'Graduate', 'PhD', 'Postdoc', 'Researcher'] },
        { key: 'department', label: 'Department', type: 'text' },
        { key: 'enrollmentYear', label: 'Enrollment Year', type: 'number' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'academic-advisor',
    name: 'Academic Advisor',
    description: 'Academic advisor guiding students on course selection, degree requirements, academic progress, and career pathways',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are an Academic Advisor at an educational institution.\nYour role: course selection guidance, degree planning, academic progress monitoring, career pathway advising.\nHelp students stay on track for graduation. Identify at-risk students early. Connect students to support resources.',
      kpis: [
        { name: 'Student retention rate', target: '> 90%' },
        { name: 'Graduation rate', target: '> 80%' },
        { name: 'Student satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'research-coordinator',
    name: 'Research Coordinator',
    description: 'Research coordinator managing research projects, compliance, ethics approvals, and collaboration across labs and institutions',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are a Research Coordinator at an educational institution.\nYour role: research project management, IRB/ethics coordination, lab resource allocation, inter-institutional collaboration.\nEnsure all research complies with institutional and funding body policies. Track milestones and deliverables.',
      kpis: [
        { name: 'Research milestones on track', target: '> 90%' },
        { name: 'IRB approvals on time', target: '100%' },
        { name: 'Publications meet annual target', target: 'On target' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'grant-administrator',
    name: 'Grant Administrator',
    description: 'Grant administrator managing grant applications, budget compliance, reporting, and post-award administration',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are a Grant Administrator at an educational institution.\nYour role: grant application support, budget preparation, compliance monitoring, post-award reporting.\nTrack all grant deadlines. Ensure allowable cost allocation. Prepare progress and financial reports for funding agencies.',
      kpis: [
        { name: 'Grant submissions', target: 'Meet annual target' },
        { name: 'Award success rate', target: '> 30%' },
        { name: 'Reporting compliance', target: '100% on time' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'admissions-officer',
    name: 'Admissions Officer',
    description: 'Admissions officer managing student applications, enrollment processing, yield optimization, and applicant communications',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are an Admissions Officer at an educational institution.\nYour role: application processing, applicant evaluation, enrollment management, yield optimization.\nEnsure fair and timely admissions decisions. Communicate clearly with prospective students. Track enrollment metrics.',
      kpis: [
        { name: 'Application processing time', target: '< 2 weeks' },
        { name: 'Yield rate', target: 'Above institutional target' },
        { name: 'Applicant satisfaction', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'faculty-support-specialist',
    name: 'Faculty Support Specialist',
    description: 'Faculty support specialist assisting with course materials, LMS administration, teaching resources, and academic technology',
    industrySlug: 'education-research',
    config: {
      systemPrompt: 'You are a Faculty Support Specialist at an educational institution.\nYour role: course material preparation, LMS administration, teaching resource coordination, academic technology support.\nEnsure faculty have everything they need before term start. Respond promptly to technical issues. Maintain instructional quality resources.',
      kpis: [
        { name: 'Course materials ready on time', target: '100%' },
        { name: 'Faculty satisfaction', target: '> 4.5/5' },
        { name: 'Support request response', target: '< 24 hours' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-student-check-in',
    name: 'Daily Student Check-In',
    description: 'Daily review of at-risk students including attendance, grades, and engagement flags',
    industrySlug: 'education-research',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Review at-risk student list: check attendance patterns, recent grades, and engagement flags. Notify academic advisors of students needing intervention.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-grant-deadline-check',
    name: 'Weekly Grant Deadline Check',
    description: 'Weekly review of upcoming grant deadlines with notifications to grant administrators and PIs',
    industrySlug: 'education-research',
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Review all upcoming grant deadlines for the next 60 days. Notify grant administrators and principal investigators of approaching deadlines and required materials.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'grant-compliance-report',
    name: 'Grant Compliance Report',
    description: 'Monthly dashboard tracking grant compliance including deadlines, deliverables, budget status, and reporting completeness',
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
    name: 'Student Progress Report',
    description: 'Quarterly dashboard tracking student enrollment, retention, graduation rates, GPA averages, and at-risk student counts',
    industrySlug: 'education-research',
    config: {
      metrics: ['enrollmentCount', 'retentionRate', 'graduationRate', 'averageGPA', 'atRiskCount'],
      period: 'quarterly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'course-development-edu',
    name: 'Develop New Course',
    description: 'Standard course development workflow from design through delivery',
    industrySlug: 'education-research',
    config: {
      description: 'Develop and deliver a new course: learning objectives, syllabus, materials, LMS setup, and first delivery',
      estimatedDuration: '4 weeks',
      assignToRole: 'faculty-support-specialist',
      subtasks: [
        'Define learning objectives and outcomes',
        'Design course syllabus and schedule',
        'Develop lecture materials and readings',
        'Create assignments and assessments',
        'Set up course in LMS',
        'Review materials with department head',
        'Launch course and monitor first week',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'research-project-setup',
    name: 'Set Up Research Project',
    description: 'Standard research project setup workflow from initiation through launch',
    industrySlug: 'education-research',
    config: {
      description: 'Set up a new research project: protocol development, ethics approval, resource allocation, team onboarding, and project launch',
      estimatedDuration: '3 weeks',
      assignToRole: 'research-coordinator',
      subtasks: [
        'Develop research protocol and methodology',
        'Submit IRB/ethics application',
        'Allocate lab space and equipment',
        'Recruit and onboard research team',
        'Set up data collection infrastructure',
        'Establish project timeline and milestones',
        'Conduct kickoff meeting with all stakeholders',
      ],
    },
  },

  // ──────────────────────────────────────────────
  // NONPROFIT & INTERNATIONAL (12 templates)
  // ──────────────────────────────────────────────
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'nonprofit-beneficiary-lifecycle',
    name: 'Nonprofit Beneficiary Lifecycle',
    description: 'Standard beneficiary lifecycle for nonprofit organizations: prospective → active → engaged/retained → alumni/lapsed → re-engagement',
    industrySlug: 'nonprofit-international',
    config: {
      stages: [
        { key: 'prospective', label: 'Prospective', order: 1 },
        { key: 'active', label: 'Active', order: 2 },
        { key: 'engaged-retained', label: 'Engaged / Retained', order: 3 },
        { key: 'alumni-lapsed', label: 'Alumni / Lapsed', order: 4 },
        { key: 're-engagement', label: 'Re-engagement', order: 5 },
      ],
      defaultStage: 'prospective',
      customerFieldDefinitions: [
        { key: 'stakeholderType', label: 'Stakeholder Type', type: 'enum', options: ['Beneficiary', 'Donor', 'Volunteer', 'Partner', 'Staff'] },
        { key: 'engagementLevel', label: 'Engagement Level', type: 'enum', options: ['Low', 'Medium', 'High', 'Champion'] },
        { key: 'lastContactDate', label: 'Last Contact Date', type: 'date' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'program-director-nonprofit',
    name: 'Program Director (Nonprofit)',
    description: 'Nonprofit program director overseeing program delivery, outcome measurement, budget management, and stakeholder engagement',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Nonprofit Program Director.\nYour role: program strategy and delivery, outcome measurement, budget stewardship, stakeholder engagement.\nAlign programs with organizational mission. Monitor impact metrics. Cultivate beneficiary and partner relationships.',
      kpis: [
        { name: 'Program outcomes achieved', target: '> 90%' },
        { name: 'Cost per beneficiary', target: 'Within budget' },
        { name: 'Donor satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'grants-manager-nonprofit',
    name: 'Grants Manager (Nonprofit)',
    description: 'Nonprofit grants manager handling grant research, proposal writing, compliance tracking, and funder reporting',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Nonprofit Grants Manager.\nYour role: grant opportunity research, proposal development, compliance tracking, funder reporting.\nMaintain a grants calendar. Ensure all grant conditions are met. Build strong relationships with funding organizations.',
      kpis: [
        { name: 'Grant proposals submitted', target: 'Meet annual target' },
        { name: 'Grant win rate', target: '> 25%' },
        { name: 'Reporting compliance', target: '100% on time' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'volunteer-coordinator',
    name: 'Volunteer Coordinator',
    description: 'Volunteer coordinator managing recruitment, onboarding, scheduling, recognition, and retention of volunteers',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Volunteer Coordinator at a nonprofit organization.\nYour role: volunteer recruitment, onboarding and training, shift scheduling, recognition programs, retention strategies.\nMatch volunteer skills to organizational needs. Ensure a positive volunteer experience. Track hours and impact.',
      kpis: [
        { name: 'Volunteer retention rate', target: '> 75%' },
        { name: 'Volunteer hours contributed', target: 'Meet annual target' },
        { name: 'Volunteer satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'donor-relations-manager',
    name: 'Donor Relations Manager',
    description: 'Donor relations manager cultivating donor relationships, managing giving programs, stewardship communications, and gift processing',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are a Donor Relations Manager at a nonprofit organization.\nYour role: donor cultivation and stewardship, giving program management, impact communication, gift processing.\nPersonalize donor communications. Track engagement and giving patterns. Ensure timely and meaningful acknowledgment.',
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
    description: 'Impact analyst measuring program outcomes, conducting evaluations, managing data quality, and producing impact reports',
    industrySlug: 'nonprofit-international',
    config: {
      systemPrompt: 'You are an Impact Analyst at a nonprofit organization.\nYour role: outcome measurement, program evaluation, data quality management, impact reporting.\nDesign and maintain M&E frameworks. Collect and analyze program data. Translate data into compelling impact stories for stakeholders.',
      kpis: [
        { name: 'Data completeness', target: '> 95%' },
        { name: 'Evaluation quality score', target: '> 4/5' },
        { name: 'Report turnaround time', target: '< 30 days' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-volunteer-reminder-nonprofit',
    name: 'Daily Volunteer Reminder (Nonprofit)',
    description: 'Daily reminder to volunteers about upcoming shifts, tasks, and organizational updates',
    industrySlug: 'nonprofit-international',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Send reminders to volunteers with shifts today. Include task assignments, location details, and any last-minute updates.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-donor-report-nonprofit',
    name: 'Monthly Donor Impact Report (Nonprofit)',
    description: 'Monthly impact report for donors highlighting program outcomes and beneficiary stories',
    industrySlug: 'nonprofit-international',
    config: {
      trigger: 'time: 5th of month 9:00 AM',
      action: 'Generate monthly donor impact report: program outcomes achieved, beneficiary stories, financial summary, upcoming initiatives.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'donor-dashboard',
    name: 'Donor Dashboard',
    description: 'Monthly dashboard tracking fundraising metrics including total raised, donor count, retention rate, average gift, and cost per dollar raised',
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
    description: 'Monthly dashboard tracking volunteer engagement including volunteer count, hours contributed, retention rate, satisfaction, and programs supported',
    industrySlug: 'nonprofit-international',
    config: {
      metrics: ['volunteerCount', 'hoursContributed', 'retentionRate', 'satisfactionScore', 'programsSupported'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'grant-proposal-nonprofit',
    name: 'Develop Grant Proposal (Nonprofit)',
    description: 'Standard grant proposal development workflow from research through submission',
    industrySlug: 'nonprofit-international',
    config: {
      description: 'Develop and submit a grant proposal: opportunity research, narrative development, budget preparation, review, and submission',
      estimatedDuration: '3 weeks',
      assignToRole: 'grants-manager-nonprofit',
      subtasks: [
        'Research grant opportunity and align with mission',
        'Develop proposal narrative and theory of change',
        'Prepare program budget and justification',
        'Gather required attachments and supporting documents',
        'Internal review by program and finance teams',
        'Revise based on feedback',
        'Submit proposal before deadline',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'volunteer-onboarding',
    name: 'Onboard New Volunteer',
    description: 'Standard volunteer onboarding workflow from application through first shift',
    industrySlug: 'nonprofit-international',
    config: {
      description: 'Onboard and train a new volunteer: application review, orientation, background check, training, and first shift assignment',
      estimatedDuration: '1 week',
      assignToRole: 'volunteer-coordinator',
      subtasks: [
        'Review volunteer application and match to needs',
        'Conduct orientation session',
        'Complete background check if required',
        'Assign role-specific training modules',
        'Set up volunteer profile and schedule',
        'Pair with experienced volunteer mentor',
        'Schedule and confirm first shift',
      ],
    },
  },

  // ──────────────────────────────────────────────
  // DEPARTMENT STRUCTURES (3)
  // ──────────────────────────────────────────────
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'government-dept-structure',
    name: 'Government Department Structure',
    description: 'Default department structure for government and public sector organizations',
    industrySlug: 'government-public-sector',
    config: {
      departments: [
        { name: 'Programs', roles: ['Manager', 'Caseworker', 'Coordinator'] },
        { name: 'Compliance & Legal', roles: ['Officer', 'Counsel', 'Analyst'] },
        { name: 'Procurement', roles: ['Specialist', 'Contract Manager'] },
        { name: 'Finance', roles: ['Budget Analyst', 'Accountant', 'Financial Manager'] },
        { name: 'IT', roles: ['Manager', 'Administrator'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'education-dept-structure',
    name: 'Education Department Structure',
    description: 'Default department structure for educational and research institutions',
    industrySlug: 'education-research',
    config: {
      departments: [
        { name: 'Academic Affairs', roles: ['Advisor', 'Faculty Support', 'Curriculum Developer'] },
        { name: 'Research', roles: ['Coordinator', 'Grant Administrator', 'Lab Manager'] },
        { name: 'Admissions', roles: ['Officer', 'Recruiter', 'Specialist'] },
        { name: 'Student Services', roles: ['Counselor', 'Career Advisor', 'Registrar'] },
        { name: 'IT', roles: ['Manager', 'LMS Administrator'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'nonprofit-dept-structure',
    name: 'Nonprofit Department Structure',
    description: 'Default department structure for nonprofit and international organizations',
    industrySlug: 'nonprofit-international',
    config: {
      departments: [
        { name: 'Programs', roles: ['Director', 'Program Manager', 'Field Officer'] },
        { name: 'Development & Fundraising', roles: ['Grants Manager', 'Donor Relations', 'Fundraising Coordinator'] },
        { name: 'Volunteer Management', roles: ['Coordinator', 'Trainer'] },
        { name: 'M&E', roles: ['Impact Analyst', 'M&E Officer', 'Data Collector'] },
        { name: 'Communications', roles: ['Manager', 'Content Creator', 'Social Media'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
];

async function seedTemplates() {
  console.log(`\nSeed public & social sector templates — ${DRY_RUN ? 'DRY RUN (checking only)' : 'WRITING to database'}\n`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.tenantTemplate.findFirst({
      where: {
        tenantId: null,
        slug: t.slug,
        templateType: t.templateType,
      },
    });

    if (existing) {
      if (VERBOSE) console.log(`  SKIP  ${t.templateType} / ${t.slug} (exists: ${existing.id})`);
      skipped++;

      const configChanged = JSON.stringify(existing.config) !== JSON.stringify(t.config);
      const nameChanged = existing.name !== t.name;
      const descChanged = (existing.description || '') !== (t.description || '');

      if (configChanged || nameChanged || descChanged) {
        if (!DRY_RUN) {
          await prisma.tenantTemplate.update({
            where: { id: existing.id },
            data: {
              name: t.name,
              description: t.description,
              config: t.config,
            },
          });
        }
        if (configChanged) console.log(`  UPDATE config  ${t.templateType} / ${t.slug}`);
        if (nameChanged) console.log(`  UPDATE name   ${t.templateType} / ${t.slug}`);
        updated++;
      }
      continue;
    }

    if (VERBOSE) console.log(`  CREATE ${t.templateType} / ${t.slug}`);

    if (!DRY_RUN) {
      await prisma.tenantTemplate.create({
        data: {
          tenantId: null,
          slug: t.slug,
          name: t.name,
          description: t.description,
          templateType: t.templateType,
          industrySlug: t.industrySlug,
          config: t.config,
          isActive: true,
          version: 1,
        },
      });
    }
    created++;
  }

  console.log(
    `\nDone. created=${created} skipped=${skipped} updated=${updated} total=${TEMPLATES.length}` +
      (DRY_RUN ? ' (dry run — no changes written)' : ''),
  );
}

seedTemplates()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
