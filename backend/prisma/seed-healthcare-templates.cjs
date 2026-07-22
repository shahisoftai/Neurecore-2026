#!/usr/bin/env node
/**
 * seed-healthcare-templates.cjs
 *
 * Stage 1 Phase 1A — Seeds system-level tenant templates (tenantId = null)
 * for the Healthcare & Life Sciences industry group.
 *
 * IDEMPOTENT: upsert keyed on (tenantId=null, slug, templateType).
 * Safe to run multiple times.
 *
 * Run: node prisma/seed-healthcare-templates.cjs
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
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'healthcare-patient-lifecycle',
    name: 'Healthcare Patient Lifecycle',
    description: 'Standard patient lifecycle for healthcare: lead → intake → prospect → active patient → discharged → at-risk → inactive',
    industrySlug: 'healthcare-life-sciences',
    config: {
      stages: [
        { key: 'lead', label: 'Lead', order: 1 },
        { key: 'intake-call', label: 'Intake Call', order: 2 },
        { key: 'prospect', label: 'Medical History Review', order: 3 },
        { key: 'active-patient', label: 'Active Patient', order: 4 },
        { key: 'discharged', label: 'Discharged', order: 5 },
        { key: 'at-risk', label: 'At-Risk', order: 6 },
        { key: 'inactive', label: 'Inactive / Archived', order: 7 },
      ],
      defaultStage: 'lead',
      customerFieldDefinitions: [
        { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
        { key: 'gender', label: 'Gender', type: 'enum', options: ['Male', 'Female', 'Non-Binary', 'Prefer Not to Say'] },
        { key: 'insuranceProvider', label: 'Insurance Provider', type: 'text' },
        { key: 'emergencyContact', label: 'Emergency Contact', type: 'text' },
        { key: 'allergies', label: 'Allergies', type: 'text' },
        { key: 'bloodType', label: 'Blood Type', type: 'enum', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'clinical-coordinator',
    name: 'Clinical Coordinator',
    description: 'Clinical coordinator role for healthcare practice',
    industrySlug: 'healthcare-life-sciences',
    config: {
      systemPrompt: 'You are a Clinical Coordinator for a healthcare practice.\nYour role: appointment scheduling, patient communications, insurance verification, care coordination.\nEnsure patients are scheduled appropriately. Verify insurance eligibility. Coordinate referrals. Maintain confidentiality per HIPAA.',
      kpis: [
        { name: 'Appointment scheduling accuracy', target: '> 98%' },
        { name: 'Insurance verification rate', target: '100% before visit' },
        { name: 'Patient satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'medical-records-clerk',
    name: 'Medical Records Clerk',
    description: 'Medical records clerk role for healthcare practice',
    industrySlug: 'healthcare-life-sciences',
    config: {
      systemPrompt: 'You are a Medical Records Clerk for a healthcare practice.\nYour role: document filing, attachment organization, release requests, records maintenance.\nMaintain accurate and complete patient records. Process release requests per HIPAA. Organize lab results and imaging.',
      kpis: [
        { name: 'Record completeness', target: '> 99%' },
        { name: 'Release request turnaround', target: '< 48 hours' },
        { name: 'HIPAA compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'lab-result-processor',
    name: 'Lab Result Processor',
    description: 'Lab result processor role for healthcare practice',
    industrySlug: 'healthcare-life-sciences',
    config: {
      systemPrompt: 'You are a Lab Result Processor for a healthcare practice.\nYour role: test result ingestion, abnormality flagging, notification to clinical staff.\nIngest lab results accurately. Flag abnormal values immediately. Notify ordering physician. Track pending results.',
      kpis: [
        { name: 'Abnormal result notification time', target: '< 30 minutes' },
        { name: 'Result processing accuracy', target: '> 99.5%' },
        { name: 'Pending result follow-up', target: '100% within 24 hours' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'patient-advocate',
    name: 'Patient Advocate',
    description: 'Patient advocate role for healthcare practice',
    industrySlug: 'healthcare-life-sciences',
    config: {
      systemPrompt: 'You are a Patient Advocate for a healthcare practice.\nYour role: insurance appeals, patient education, follow-up calls, satisfaction surveys.\nAdvocate for patients with insurance companies. Educate patients on care plans. Conduct post-visit follow-up. Maintain empathy and professionalism.',
      kpis: [
        { name: 'Insurance appeal success rate', target: '> 80%' },
        { name: 'Patient education comprehension', target: '> 90%' },
        { name: 'Follow-up completion', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'billing-specialist-healthcare',
    name: 'Billing Specialist (Healthcare)',
    description: 'Billing specialist role for healthcare practice',
    industrySlug: 'healthcare-life-sciences',
    config: {
      systemPrompt: 'You are a Billing Specialist for a healthcare practice.\nYour role: insurance coding, claim submission, payment tracking, denial management.\nCode encounters accurately. Submit clean claims. Track payments. Appeal denials. Maintain compliance with coding standards.',
      kpis: [
        { name: 'Clean claim rate', target: '> 95%' },
        { name: 'Days in A/R', target: '< 30 days' },
        { name: 'Denial rate', target: '< 5%' },
      ],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-appointment-reminders',
    name: 'Daily Appointment Reminders',
    description: 'Send appointment reminders to patients with upcoming appointments',
    industrySlug: 'healthcare-life-sciences',
    config: {
      trigger: 'time: 8:00 AM daily',
      action: 'Send appointment reminders to all patients with appointments in the next 24 hours. Include time, location, and preparation instructions.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-lab-result-alert',
    name: 'Daily Lab Result Alert',
    description: 'Summarize abnormal lab results and flag critical values',
    industrySlug: 'healthcare-life-sciences',
    config: {
      trigger: 'time: 9:00 AM daily',
      action: 'Summarize all abnormal lab results received in the past 24 hours. Flag critical values for immediate attention. Notify ordering physicians.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'insurance-verification-reminder',
    name: 'Insurance Verification Reminder',
    description: 'Flag patients with unverified insurance before upcoming appointments',
    industrySlug: 'healthcare-life-sciences',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'List all patients with appointments in the next 7 days whose insurance has not been verified. Flag for immediate verification.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'post-discharge-follow-up',
    name: 'Post-Discharge Follow-Up',
    description: 'Send satisfaction survey and follow-up reminders to discharged patients',
    industrySlug: 'healthcare-life-sciences',
    config: {
      trigger: 'time: 10:00 AM daily',
      action: 'Identify patients discharged 48 hours ago. Send satisfaction survey and remind them to schedule follow-up appointment if needed.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'REPORT',
    slug: 'patient-volume-trend',
    name: 'Patient Volume Trend Report',
    description: 'Monthly patient volume dashboard',
    industrySlug: 'healthcare-life-sciences',
    config: {
      metrics: ['totalPatients', 'newPatients', 'returnPatients', 'patientsByDepartment', 'patientsByProvider'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'appointment-efficiency',
    name: 'Appointment Efficiency Report',
    description: 'Weekly appointment efficiency dashboard',
    industrySlug: 'healthcare-life-sciences',
    config: {
      metrics: ['noShowRate', 'averageWaitTime', 'sameDayCancellationRate', 'appointmentUtilization', 'overbookingRate'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'clinical-outcomes',
    name: 'Clinical Outcomes Report',
    description: 'Monthly clinical outcomes dashboard',
    industrySlug: 'healthcare-life-sciences',
    config: {
      metrics: ['treatmentCompletionRate', 'readmissionRate', 'patientSatisfactionScore', 'complicationRate', 'averageRecoveryDays'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'revenue-cycle-healthcare',
    name: 'Revenue Cycle Report (Healthcare)',
    description: 'Monthly healthcare revenue cycle dashboard',
    industrySlug: 'healthcare-life-sciences',
    config: {
      metrics: ['claimApprovalRate', 'daysToPayment', 'arAging', 'denialRate', 'collectionRate'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'new-patient-onboarding',
    name: 'New Patient Onboarding',
    description: 'Standard new patient onboarding workflow',
    industrySlug: 'healthcare-life-sciences',
    config: {
      description: 'Onboard a new patient: collect demographics, medical history, insurance, schedule initial assessment',
      estimatedDuration: '1 day',
      assignToRole: 'clinical-coordinator',
      subtasks: [
        'Collect patient demographics and contact info',
        'Obtain and verify insurance information',
        'Collect medical history and current medications',
        'Document allergies and conditions',
        'Schedule initial assessment with provider',
        'Send welcome packet and forms',
        'Create patient chart in system',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'appointment-scheduling',
    name: 'Appointment Scheduling',
    description: 'Standard appointment scheduling workflow',
    industrySlug: 'healthcare-life-sciences',
    config: {
      description: 'Schedule a patient appointment: provider matching, room booking, preparation instructions',
      estimatedDuration: '30 minutes',
      assignToRole: 'clinical-coordinator',
      subtasks: [
        'Determine appointment type and duration',
        'Check provider availability',
        'Verify insurance eligibility',
        'Book room and equipment if needed',
        'Send confirmation to patient',
        'Include preparation instructions',
        'Set appointment reminders',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'lab-result-processing',
    name: 'Lab Result Processing',
    description: 'Standard lab result processing workflow',
    industrySlug: 'healthcare-life-sciences',
    config: {
      description: 'Process incoming lab results: data entry, abnormality check, physician notification, patient filing',
      estimatedDuration: '1 hour',
      assignToRole: 'lab-result-processor',
      subtasks: [
        'Receive and verify lab result',
        'Enter results into patient record',
        'Check for abnormal values',
        'Flag critical results for immediate attention',
        'Notify ordering physician',
        'File result in patient chart',
        'Schedule follow-up if indicated',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'discharge-planning',
    name: 'Discharge Planning',
    description: 'Standard patient discharge planning workflow',
    industrySlug: 'healthcare-life-sciences',
    config: {
      description: 'Plan and execute patient discharge: instructions, medications, follow-up appointments, home care',
      estimatedDuration: '2 hours',
      assignToRole: 'clinical-coordinator',
      subtasks: [
        'Prepare discharge summary and instructions',
        'Review medications and prescriptions',
        'Schedule follow-up appointment',
        'Coordinate home care or therapy if needed',
        'Provide patient education materials',
        'Process discharge paperwork',
        'Update patient status in system',
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'healthcare-dept-structure',
    name: 'Healthcare Department Structure',
    description: 'Default department structure for healthcare practices',
    industrySlug: 'healthcare-life-sciences',
    config: {
      departments: [
        { name: 'Clinical Operations', roles: ['Clinical Coordinator', 'Physician', 'Nurse Practitioner', 'Physician Assistant'] },
        { name: 'Nursing', roles: ['Registered Nurse', 'Licensed Practical Nurse', 'Certified Nursing Assistant'] },
        { name: 'Pharmacy', roles: ['Pharmacist', 'Pharmacy Technician'] },
        { name: 'Laboratory', roles: ['Lab Result Processor', 'Lab Technician', 'Phlebotomist'] },
        { name: 'Patient Services', roles: ['Patient Advocate', 'Front Desk Coordinator', 'Medical Records Clerk'] },
        { name: 'Billing & Insurance', roles: ['Billing Specialist', 'Medical Coder', 'Insurance Coordinator'] },
        { name: 'Administration', roles: ['Practice Manager', 'Executive Assistant'] },
      ],
    },
  },
];

async function seedTemplates() {
  console.log(`\nSeed industry templates — ${DRY_RUN ? 'DRY RUN (checking only)' : 'WRITING to database'}\n`);

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
