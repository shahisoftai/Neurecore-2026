import { TemplateType } from '@prisma/client';

export const HEALTHCARE_TEMPLATES: SeedTemplate[] = [
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'healthcare-patient-lifecycle',
    name: 'Healthcare Patient Lifecycle',
    description: 'Patient journey: lead → intake → prospect → active patient → discharged → at-risk → inactive',
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
    description: 'Coordinates appointments, patient communications, and insurance verification',
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
    description: 'Manages patient medical records, attachments, and release requests',
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
    description: 'Processes lab results, flags abnormalities, and notifies clinical staff',
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
    description: 'Handles insurance appeals, patient education, and follow-up calls',
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
    name: 'Billing Specialist',
    description: 'Handles insurance coding, claim submission, and payment tracking',
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
    description: 'Send 24-hour appointment reminders to patients via SMS/email',
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
    name: 'Daily Lab Result Alert Digest',
    description: 'Review and flag all abnormal lab results for clinical staff review',
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
    description: 'Remind staff to verify insurance for upcoming appointments',
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
    description: 'Send satisfaction survey and next appointment reminder 48h after discharge',
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
    description: 'Monthly/quarterly patient count by type, department, and provider',
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
    description: 'No-show rate, average wait time, same-day cancellations',
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
    name: 'Clinical Outcomes Dashboard',
    description: 'Treatment completion rate, readmission rate, patient satisfaction',
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
    name: 'Revenue Cycle Report',
    description: 'Insurance claim approval rate, days-to-payment, A/R aging',
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
    description: 'Complete new patient intake: registration, history, insurance, initial assessment',
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
    name: 'Patient Appointment Scheduling',
    description: 'Schedule patient appointments with appropriate resources and preparation',
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
    description: 'Process and review incoming lab results',
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
    name: 'Patient Discharge Planning',
    description: 'Complete discharge process: instructions, prescriptions, follow-up',
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
    name: 'Healthcare Practice Department Structure',
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

export interface SeedTemplate {
  templateType: TemplateType;
  slug: string;
  name: string;
  description?: string;
  industrySlug: string;
  config: Record<string, unknown>;
}
