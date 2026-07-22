#!/usr/bin/env node
/**
 * seed-industrial-infra-templates.cjs
 *
 * Stage 1 Phase 1B — Seeds system-level tenant templates (tenantId = null)
 * for Manufacturing, Construction, Energy, and Logistics industries.
 *
 * IDEMPOTENT: upsert keyed on (tenantId=null, slug, templateType).
 * Safe to run multiple times.
 *
 * Run: node prisma/seed-industrial-infra-templates.cjs
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

const MANUF = 'manufacturing-industrial';
const CONST = 'construction-engineering-infrastructure';
const ENERGY = 'energy-utilities-natural-resources';
const LOG   = 'logistics-transportation-supply-chain';

const TEMPLATES = [
  // ──────────────────────────────────────────────────────────────────
  // CUSTOMER_LIFECYCLE (4)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'manufacturing-supplier-lifecycle',
    name: 'Manufacturing Supplier Lifecycle',
    description: 'Supplier lifecycle for manufacturing: prospect → active → qualified → long-term partner → inactive',
    industrySlug: MANUF,
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'active', label: 'Active', order: 2 },
        { key: 'qualified', label: 'Qualified', order: 3 },
        { key: 'long-term-partner', label: 'Long-Term Partner', order: 4 },
        { key: 'inactive', label: 'Inactive', order: 5 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'partnerType', label: 'Partner Type', type: 'enum', options: ['Supplier', 'Customer', 'Both'] },
        { key: 'qualityCertification', label: 'Quality Certification', type: 'enum', options: ['ISO 9001', 'IATF 16949', 'AS9100', 'None'] },
        { key: 'annualVolume', label: 'Annual Volume', type: 'number' },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'construction-project-lifecycle',
    name: 'Construction Project Lifecycle',
    description: 'Project lifecycle for construction: bid → contract-awarded → active-delivery → substantial-completion → final-completion → warranty',
    industrySlug: CONST,
    config: {
      stages: [
        { key: 'bid', label: 'Bid', order: 1 },
        { key: 'contract-awarded', label: 'Contract Awarded', order: 2 },
        { key: 'active-delivery', label: 'Active Delivery', order: 3 },
        { key: 'substantial-completion', label: 'Substantial Completion', order: 4 },
        { key: 'final-completion', label: 'Final Completion', order: 5 },
        { key: 'warranty', label: 'Warranty', order: 6 },
      ],
      defaultStage: 'bid',
      customerFieldDefinitions: [
        { key: 'projectType', label: 'Project Type', type: 'enum', options: ['Residential', 'Commercial', 'Industrial', 'Infrastructure', 'Renovation'] },
        { key: 'contractValue', label: 'Contract Value', type: 'number' },
        { key: 'bondingRequired', label: 'Bonding Required', type: 'boolean' },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'energy-service-lifecycle',
    name: 'Energy Service Lifecycle',
    description: 'Service lifecycle for energy utilities: new-service-request → connected → active → maintenance → potential-disconnection → closed',
    industrySlug: ENERGY,
    config: {
      stages: [
        { key: 'new-service-request', label: 'New Service Request', order: 1 },
        { key: 'connected', label: 'Connected', order: 2 },
        { key: 'active', label: 'Active', order: 3 },
        { key: 'maintenance', label: 'Maintenance', order: 4 },
        { key: 'potential-disconnection', label: 'Potential Disconnection', order: 5 },
        { key: 'closed', label: 'Closed', order: 6 },
      ],
      defaultStage: 'new-service-request',
      customerFieldDefinitions: [
        { key: 'serviceType', label: 'Service Type', type: 'enum', options: ['Residential', 'Commercial', 'Industrial', 'Government'] },
        { key: 'meterType', label: 'Meter Type', type: 'enum', options: ['Standard', 'Smart', 'AMR'] },
        { key: 'ratePlan', label: 'Rate Plan', type: 'enum', options: ['Fixed', 'Time-of-Use', 'Tiered', 'Demand'] },
      ],
    },
  },
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'logistics-shipment-lifecycle',
    name: 'Logistics Shipment Lifecycle',
    description: 'Customer lifecycle for logistics: prospect → contracted → active-shipments → long-term-partner → renewal-churn',
    industrySlug: LOG,
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'contracted', label: 'Contracted', order: 2 },
        { key: 'active-shipments', label: 'Active Shipments', order: 3 },
        { key: 'long-term-partner', label: 'Long-Term Partner', order: 4 },
        { key: 'renewal-churn', label: 'Renewal / Churn', order: 5 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'customerType', label: 'Customer Type', type: 'enum', options: ['Shipper', 'Consignee', 'Carrier', 'Broker'] },
        { key: 'shipmentVolume', label: 'Shipment Volume', type: 'number' },
        { key: 'primaryLane', label: 'Primary Lane', type: 'text' },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // AGENT_ROLES — manufacturing-industrial (5)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'AGENT_ROLE',
    slug: 'production-scheduler',
    name: 'Production Scheduler',
    description: 'Production scheduling and planning role for manufacturing',
    industrySlug: MANUF,
    config: {
      systemPrompt: 'You are a Production Scheduler for a manufacturing facility.\nYour role: production planning, capacity scheduling, work order sequencing, resource allocation, demand forecasting.\nOptimise production schedules for maximum throughput. Balance line capacity. Coordinate with supply chain on material availability. Reschedule dynamically based on machine downtime or priority changes.',
      kpis: [
        { name: 'OEE (Overall Equipment Effectiveness)', target: '> 85%' },
        { name: 'Schedule adherence', target: '> 95%' },
        { name: 'On-time delivery', target: '> 97%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'quality-auditor',
    name: 'Quality Auditor',
    description: 'Quality inspection and audit role for manufacturing',
    industrySlug: MANUF,
    config: {
      systemPrompt: 'You are a Quality Auditor for a manufacturing facility.\nYour role: quality inspections, defect tracking, root cause analysis, CAPA management, supplier quality audits.\nFollow ISO 9001 / IATF 16949 standards. Document all non-conformances. Drive defect rate below 1%. Ensure inspection checklists are completed for every batch.',
      kpis: [
        { name: 'Defect rate', target: '< 1%' },
        { name: 'First-pass yield', target: '> 98%' },
        { name: 'CAPA closure rate', target: '> 90% within 30 days' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'maintenance-coordinator',
    name: 'Maintenance Coordinator',
    description: 'Preventive and corrective maintenance coordination role',
    industrySlug: MANUF,
    config: {
      systemPrompt: 'You are a Maintenance Coordinator for a manufacturing facility.\nYour role: preventive maintenance scheduling, work order management, spare parts planning, downtime tracking, equipment reliability.\nEnsure PM compliance above 95%. Minimise unplanned downtime. Schedule maintenance windows during production lulls. Track MTBF and MTTR for all critical equipment.',
      kpis: [
        { name: 'PM compliance rate', target: '> 95%' },
        { name: 'Unplanned downtime', target: '< 2%' },
        { name: 'Work order completion', target: '> 98% on time' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'supply-chain-manager',
    name: 'Supply Chain Manager',
    description: 'Supply chain and procurement management role for manufacturing',
    industrySlug: MANUF,
    config: {
      systemPrompt: 'You are a Supply Chain Manager for a manufacturing facility.\nYour role: supplier management, procurement, inventory optimisation, logistics coordination, demand planning.\nMaintain supplier OTD above 95%. Optimise inventory levels to balance carrying cost with production risk. Negotiate supplier contracts. Monitor raw material lead times and flag shortages early.',
      kpis: [
        { name: 'Supplier on-time delivery', target: '> 95%' },
        { name: 'Inventory turnover', target: '> 8 turns/year' },
        { name: 'Procurement cost savings', target: '> 3% YoY' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'safety-officer',
    name: 'Safety Officer',
    description: 'Workplace safety and compliance officer for manufacturing',
    industrySlug: MANUF,
    config: {
      systemPrompt: 'You are a Safety Officer for a manufacturing facility.\nYour role: safety inspections, incident investigation, OSHA compliance, safety training, hazard identification.\nMaintain incident rate below 1 per 100 workers. Conduct daily safety walkthroughs. Ensure PPE compliance. Lead root cause investigations for all incidents. Track near-misses and corrective actions.',
      kpis: [
        { name: 'Recordable incident rate', target: '< 1/100 workers' },
        { name: 'Safety training completion', target: '100%' },
        { name: 'Near-miss reports closed', target: '> 95% within 7 days' },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // AGENT_ROLES — construction-engineering-infrastructure (5)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'AGENT_ROLE',
    slug: 'construction-pm',
    name: 'Construction Project Manager',
    description: 'Project manager for construction and engineering projects',
    industrySlug: CONST,
    config: {
      systemPrompt: 'You are a Construction Project Manager.\nYour role: project planning, budget management, schedule tracking, stakeholder communication, risk management.\nMaintain schedule variance below 5%. Track earned value against planned. Coordinate with subcontractors and suppliers. Manage change orders and RFIs. Report project status weekly to stakeholders.',
      kpis: [
        { name: 'Schedule variance', target: '< 5%' },
        { name: 'Budget variance', target: '< 3%' },
        { name: 'Project milestones on time', target: '> 90%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'site-superintendent',
    name: 'Site Superintendent',
    description: 'Site superintendent for construction projects',
    industrySlug: CONST,
    config: {
      systemPrompt: 'You are a Site Superintendent for a construction project.\nYour role: site supervision, crew management, daily progress tracking, safety enforcement, quality control.\nMaintain rework rate below 2%. Conduct daily site inspections. Coordinate trade schedules. Enforce safety protocols. Resolve field issues before they escalate.',
      kpis: [
        { name: 'Rework rate', target: '< 2%' },
        { name: 'Daily productivity target', target: '> 95%' },
        { name: 'Safety incidents', target: '0' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'civil-engineer',
    name: 'Civil Engineer',
    description: 'Civil engineer for construction design review and technical oversight',
    industrySlug: CONST,
    config: {
      systemPrompt: 'You are a Civil Engineer for a construction firm.\nYour role: design review, structural analysis, specification compliance, technical submittal review, site inspections.\nComplete design reviews within 5 business days. Verify structural calculations. Review shop drawings. Ensure compliance with building codes and specifications. Coordinate with MEP and structural engineers.',
      kpis: [
        { name: 'Design review turnaround', target: '< 5 days' },
        { name: 'RFI response time', target: '< 3 days' },
        { name: 'Submittal approval rate', target: '> 95% first pass' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-officer-construction',
    name: 'Compliance Officer (Construction)',
    description: 'Compliance and permitting officer for construction',
    industrySlug: CONST,
    config: {
      systemPrompt: 'You are a Compliance Officer for a construction firm.\nYour role: permit management, regulatory compliance, environmental approvals, building code adherence, inspection coordination.\nMaintain permit approval rate above 95%. Track all permit expiration dates. Coordinate with municipal authorities. Ensure environmental compliance documentation is current. Prepare for regulatory audits.',
      kpis: [
        { name: 'Permit approval rate', target: '> 95%' },
        { name: 'Compliance audit score', target: '100%' },
        { name: 'Violation notices', target: '0' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'procurement-specialist',
    name: 'Procurement Specialist',
    description: 'Procurement specialist for construction materials and subcontracts',
    industrySlug: CONST,
    config: {
      systemPrompt: 'You are a Procurement Specialist for a construction firm.\nYour role: material procurement, subcontractor sourcing, bid evaluation, purchase order management, vendor negotiation.\nAchieve cost savings above 5% through competitive bidding and negotiation. Ensure material deliveries align with construction schedule. Qualify new vendors. Manage long-lead item tracking.',
      kpis: [
        { name: 'Cost savings vs budget', target: '> 5%' },
        { name: 'Material on-time delivery', target: '> 95%' },
        { name: 'PO cycle time', target: '< 3 days' },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // AGENT_ROLES — energy-utilities-natural-resources (5)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'AGENT_ROLE',
    slug: 'asset-manager-energy',
    name: 'Asset Manager (Energy)',
    description: 'Asset manager for energy utility infrastructure',
    industrySlug: ENERGY,
    config: {
      systemPrompt: 'You are an Asset Manager for an energy utility.\nYour role: asset lifecycle management, condition monitoring, capital planning, reliability engineering, maintenance strategy.\nMaintain asset availability above 99%. Develop asset replacement plans based on condition scores. Track asset health indices. Prioritise capital investments. Coordinate with field operations on critical asset repairs.',
      kpis: [
        { name: 'Asset availability', target: '> 99%' },
        { name: 'Condition score', target: '> 3.5/5 average' },
        { name: 'Maintenance backlog', target: '< 30 days' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'outage-coordinator',
    name: 'Outage Coordinator',
    description: 'Outage management coordinator for energy utilities',
    industrySlug: ENERGY,
    config: {
      systemPrompt: 'You are an Outage Coordinator for an energy utility.\nYour role: outage response, crew dispatch, restoration tracking, customer communication, root cause analysis.\nMaintain MTTR below 2 hours. Coordinate field crews during storm events. Prioritise restoration based on criticality. Communicate estimated restoration times to customers. Track outage metrics and identify repeat outage patterns.',
      kpis: [
        { name: 'Mean time to restore (MTTR)', target: '< 2 hours' },
        { name: 'CAIDI', target: '< 90 minutes' },
        { name: 'Repeat outage rate', target: '< 2%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-manager-energy',
    name: 'Compliance Manager (Energy)',
    description: 'Regulatory compliance manager for energy utilities',
    industrySlug: ENERGY,
    config: {
      systemPrompt: 'You are a Compliance Manager for an energy utility.\nYour role: regulatory filing, NERC/FERC compliance, environmental reporting, audit preparation, tariff management.\nMaintain 100% on-time regulatory filing rate. Track all compliance deadlines. Prepare audit documentation. Monitor regulatory changes. Coordinate with legal on rate cases and tariff filings.',
      kpis: [
        { name: 'Regulatory filing on-time rate', target: '100%' },
        { name: 'Audit findings', target: '0 material findings' },
        { name: 'Compliance training completion', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'technician-dispatcher',
    name: 'Technician Dispatcher',
    description: 'Field technician dispatcher for energy utilities',
    industrySlug: ENERGY,
    config: {
      systemPrompt: 'You are a Technician Dispatcher for an energy utility.\nYour role: work order dispatch, route optimisation, crew scheduling, SLA management, real-time tracking.\nAchieve first-time fix rate above 85%. Optimise technician routes to minimise travel time. Prioritise emergency vs routine work orders. Ensure technicians have required parts and equipment before dispatch.',
      kpis: [
        { name: 'First-time fix rate', target: '> 85%' },
        { name: 'Average response time', target: '< 60 minutes' },
        { name: 'Technician utilisation', target: '> 80%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'environmental-safety-officer',
    name: 'Environmental Safety Officer',
    description: 'Environmental and safety officer for energy operations',
    industrySlug: ENERGY,
    config: {
      systemPrompt: 'You are an Environmental Safety Officer for an energy utility.\nYour role: environmental compliance, safety inspections, incident prevention, spill response, sustainability reporting.\nTarget zero environmental incidents. Conduct environmental impact assessments. Monitor emissions and waste. Ensure spill prevention and response plans are current. Track sustainability KPIs.',
      kpis: [
        { name: 'Environmental incidents', target: '0' },
        { name: 'Safety inspection completion', target: '100%' },
        { name: 'Emissions compliance', target: '100% within limits' },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // AGENT_ROLES — logistics-transportation-supply-chain (4)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'AGENT_ROLE',
    slug: 'logistics-manager',
    name: 'Logistics Manager',
    description: 'Logistics and transportation operations manager',
    industrySlug: LOG,
    config: {
      systemPrompt: 'You are a Logistics Manager.\nYour role: transportation planning, carrier management, route optimisation, cost control, service level management.\nMaintain on-time delivery above 98%. Optimise carrier mix for cost and service. Monitor freight spend and identify savings. Manage exceptions and escalations. Track KPIs across all lanes.',
      kpis: [
        { name: 'On-time delivery', target: '> 98%' },
        { name: 'Cost per shipment', target: '< 5% variance to budget' },
        { name: 'Carrier performance score', target: '> 4.2/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'shipment-coordinator',
    name: 'Shipment Coordinator',
    description: 'Shipment coordination and tracking role for logistics',
    industrySlug: LOG,
    config: {
      systemPrompt: 'You are a Shipment Coordinator for a logistics company.\nYour role: shipment booking, tracking, documentation, exception management, customer updates.\nMaintain shipment accuracy above 99%. Book shipments with optimal carriers. Track shipments in real time. Handle customs documentation. Proactively communicate delays to customers.',
      kpis: [
        { name: 'Shipment accuracy', target: '> 99%' },
        { name: 'Booking turnaround', target: '< 2 hours' },
        { name: 'Customer notification compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'warehouse-supervisor',
    name: 'Warehouse Supervisor',
    description: 'Warehouse operations supervisor for logistics',
    industrySlug: LOG,
    config: {
      systemPrompt: 'You are a Warehouse Supervisor for a logistics facility.\nYour role: warehouse operations, inventory accuracy, picking and packing, receiving, shift management.\nMaintain order accuracy above 99.5%. Optimise warehouse layout for picking efficiency. Manage labour allocation across shifts. Ensure safety compliance. Track cycle count accuracy.',
      kpis: [
        { name: 'Order accuracy', target: '> 99.5%' },
        { name: 'Picking productivity', target: '> 100 lines/hour' },
        { name: 'Inventory accuracy', target: '> 99%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'driver-operator',
    name: 'Driver / Operator',
    description: 'Driver and vehicle operator role for logistics',
    industrySlug: LOG,
    config: {
      systemPrompt: 'You are a Driver/Operator for a logistics company.\nYour role: vehicle operation, delivery execution, route adherence, vehicle inspection, customer interaction.\nMaintain on-time delivery above 99%. Complete pre-trip and post-trip inspections. Adhere to HOS regulations. Report vehicle issues immediately. Provide professional customer service at delivery points.',
      kpis: [
        { name: 'On-time delivery', target: '> 99%' },
        { name: 'Vehicle inspection compliance', target: '100%' },
        { name: 'Safety incidents', target: '0' },
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // ROUTINES (8)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'ROUTINE',
    slug: 'daily-production-standup',
    name: 'Daily Production Standup',
    description: 'Daily production standup meeting for manufacturing',
    industrySlug: MANUF,
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Summarise previous day production: output, OEE, downtime, quality issues. Flag at-risk work orders. Review today\'s schedule and resource allocation.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-quality-review',
    name: 'Weekly Quality Review',
    description: 'Weekly quality metrics review for manufacturing',
    industrySlug: MANUF,
    config: {
      trigger: 'time: Friday 2:00 PM',
      action: 'Compile weekly quality report: defect rates, first-pass yield, customer returns, supplier quality, CAPA status. Identify top 3 quality issues for root cause analysis.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-site-safety-briefing',
    name: 'Daily Site Safety Briefing',
    description: 'Daily site safety briefing for construction',
    industrySlug: CONST,
    config: {
      trigger: 'time: 6:30 AM daily',
      action: 'Conduct daily safety briefing: review today\'s high-risk activities, verify PPE requirements, check weather conditions, confirm emergency procedures. Document all attendees.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-permit-status',
    name: 'Weekly Permit Status Review',
    description: 'Weekly permit and approval status check for construction',
    industrySlug: CONST,
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Review all active permit applications and expiring permits. Flag any approaching deadlines (within 14 days). Update permit tracker with current statuses.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-outage-briefing',
    name: 'Daily Outage Briefing',
    description: 'Daily outage status briefing for energy utilities',
    industrySlug: ENERGY,
    config: {
      trigger: 'time: 8:00 AM daily',
      action: 'Summarise current outage status: active outages, customers affected, estimated restoration times, crew deployment, weather forecast impact. Escalate any outage exceeding SLA.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-compliance-review',
    name: 'Monthly Compliance Review',
    description: 'Monthly regulatory compliance review for energy utilities',
    industrySlug: ENERGY,
    config: {
      trigger: 'time: 5th of month 9:00 AM',
      action: 'Review all regulatory filings due this month. Verify previous month filings are complete and acknowledged. Compile compliance dashboard for management review.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-shipment-status',
    name: 'Daily Shipment Status Report',
    description: 'Daily shipment status check for logistics',
    industrySlug: LOG,
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Review all in-transit shipments. Flag delayed or at-risk shipments. Update customer notifications. Prioritise hot shipments. Review carrier performance from previous day.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-fleet-maintenance-check',
    name: 'Weekly Fleet Maintenance Check',
    description: 'Weekly fleet maintenance status review for logistics',
    industrySlug: LOG,
    config: {
      trigger: 'time: Monday 7:00 AM',
      action: 'Review fleet maintenance schedule for the week. Verify all vehicles are current on PM. Flag vehicles due for service. Schedule maintenance windows to minimise operational impact.',
      channels: ['in-app', 'email'],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // REPORTS (8)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'REPORT',
    slug: 'production-efficiency-dashboard',
    name: 'Production Efficiency Dashboard',
    description: 'Daily production efficiency dashboard for manufacturing',
    industrySlug: MANUF,
    config: {
      metrics: ['oee', 'throughput', 'downtime', 'scrapRate', 'changeoverTime'],
      period: 'daily',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'quality-metrics-report',
    name: 'Quality Metrics Report',
    description: 'Monthly quality metrics report for manufacturing',
    industrySlug: MANUF,
    config: {
      metrics: ['defectRate', 'firstPassYield', 'customerReturns', 'supplierQuality', 'costOfQuality'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'construction-project-dashboard',
    name: 'Construction Project Dashboard',
    description: 'Weekly construction project performance dashboard',
    industrySlug: CONST,
    config: {
      metrics: ['scheduleVariance', 'budgetVariance', 'safetyIncidents', 'completedMilestones', 'changeOrderValue'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'subcontractor-performance',
    name: 'Subcontractor Performance Report',
    description: 'Monthly subcontractor performance evaluation report',
    industrySlug: CONST,
    config: {
      metrics: ['onTimeCompletion', 'qualityScore', 'safetyRecord', 'costVariance', 'reworkRate'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'asset-health-dashboard',
    name: 'Asset Health Dashboard',
    description: 'Monthly asset health and reliability dashboard for energy utilities',
    industrySlug: ENERGY,
    config: {
      metrics: ['assetAvailability', 'conditionScore', 'maintenanceBacklog', 'failureRate', 'remainingLife'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'outage-performance-report',
    name: 'Outage Performance Report',
    description: 'Monthly outage performance and reliability report for energy utilities',
    industrySlug: ENERGY,
    config: {
      metrics: ['totalOutages', 'meanTimeToRestore', 'customersAffected', 'responseTime', 'repeatOutages'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'logistics-performance-dashboard',
    name: 'Logistics Performance Dashboard',
    description: 'Weekly logistics performance dashboard',
    industrySlug: LOG,
    config: {
      metrics: ['onTimeDelivery', 'costPerShipment', 'damageRate', 'utilizationRate', 'customerSatisfaction'],
      period: 'weekly',
      format: 'dashboard',
    },
  },
  {
    templateType: 'REPORT',
    slug: 'fleet-utilization-report',
    name: 'Fleet Utilization Report',
    description: 'Monthly fleet utilization and efficiency report for logistics',
    industrySlug: LOG,
    config: {
      metrics: ['fleetUtilization', 'fuelEfficiency', 'maintenanceCost', 'idleTime', 'driverUtilization'],
      period: 'monthly',
      format: 'dashboard',
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // TASK_TEMPLATES (10)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'production-run-setup',
    name: 'Production Run Setup',
    description: 'Standard production run setup and changeover workflow',
    industrySlug: MANUF,
    config: {
      description: 'Complete production run setup including line clearance, material staging, machine setup, first article inspection',
      estimatedDuration: '1 day',
      assignToRole: 'production-scheduler',
      subtasks: [
        'Verify work order and BOM',
        'Clear previous run materials from line',
        'Stage raw materials and components',
        'Configure machine settings per specification',
        'Perform first article inspection',
        'Obtain quality sign-off',
        'Log setup completion in MES',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'root-cause-analysis',
    name: 'Root Cause Analysis (8D)',
    description: 'Structured root cause analysis using 8D methodology for quality issues',
    industrySlug: MANUF,
    config: {
      description: 'Conduct 8D root cause analysis: define problem, assemble team, contain issue, identify root cause, implement corrective action, verify effectiveness, prevent recurrence',
      estimatedDuration: '3 days',
      assignToRole: 'quality-auditor',
      subtasks: [
        'Define problem statement and scope',
        'Assemble cross-functional team',
        'Implement immediate containment actions',
        'Identify root cause using 5-Why / Fishbone',
        'Develop and validate corrective actions',
        'Implement permanent corrective actions',
        'Verify effectiveness and close 8D report',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'pm-work-order',
    name: 'Preventive Maintenance Work Order',
    description: 'Standard preventive maintenance work order execution',
    industrySlug: MANUF,
    config: {
      description: 'Execute scheduled preventive maintenance: inspection, lubrication, parts replacement, testing, documentation',
      estimatedDuration: '4 hours',
      assignToRole: 'maintenance-coordinator',
      subtasks: [
        'Review PM checklist and procedures',
        'Lockout/tagout equipment per safety protocol',
        'Perform visual inspection and measurements',
        'Replace wear parts and consumables',
        'Lubricate and calibrate per schedule',
        'Run functional test and verify performance',
        'Document findings and close work order in CMMS',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'site-preparation',
    name: 'Site Preparation & Mobilisation',
    description: 'Construction site preparation and mobilisation workflow',
    industrySlug: CONST,
    config: {
      description: 'Prepare construction site: site survey, permitting verification, utility location, temporary facilities, material laydown, access control',
      estimatedDuration: '1 week',
      assignToRole: 'site-superintendent',
      subtasks: [
        'Complete pre-construction site survey',
        'Verify all permits are posted and active',
        'Coordinate utility locates and markouts',
        'Set up temporary facilities and site office',
        'Establish material laydown and staging areas',
        'Install site security and access control',
        'Conduct site orientation for all crews',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'inspection-preparation',
    name: 'Inspection Preparation',
    description: 'Prepare for regulatory and quality inspections on construction sites',
    industrySlug: CONST,
    config: {
      description: 'Prepare for upcoming inspection: document review, site walk, deficiency resolution, test records, sign-off coordination',
      estimatedDuration: '2 days',
      assignToRole: 'construction-pm',
      subtasks: [
        'Review inspection checklist and requirements',
        'Compile all relevant documentation and test records',
        'Conduct pre-inspection site walkthrough',
        'Resolve identified deficiencies',
        'Coordinate inspector access and logistics',
        'Brief site team on inspection protocols',
        'Document inspection results and follow-up actions',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'outage-restoration',
    name: 'Outage Restoration',
    description: 'Emergency outage restoration workflow for energy utilities',
    industrySlug: ENERGY,
    config: {
      description: 'Respond to and restore power outage: fault location, isolation, repair, testing, service restoration, customer communication',
      estimatedDuration: '4 hours',
      assignToRole: 'outage-coordinator',
      subtasks: [
        'Receive and acknowledge outage notification',
        'Dispatch field crew to fault location',
        'Identify and isolate faulted section',
        'Execute repair or switching operation',
        'Test circuit before re-energisation',
        'Restore service and verify all customers',
        'Document outage details and close in OMS',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'regulatory-filing',
    name: 'Regulatory Filing',
    description: 'Regulatory compliance filing workflow for energy utilities',
    industrySlug: ENERGY,
    config: {
      description: 'Prepare and submit regulatory filing: data collection, analysis, document preparation, internal review, submission, confirmation',
      estimatedDuration: '2 weeks',
      assignToRole: 'compliance-manager-energy',
      subtasks: [
        'Identify filing requirements and deadline',
        'Collect required data from all departments',
        'Analyse data and prepare draft filing',
        'Conduct internal legal and technical review',
        'Incorporate review feedback and revisions',
        'Submit filing to regulatory authority',
        'Confirm receipt and track acknowledgement',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'shipment-booking',
    name: 'Shipment Booking',
    description: 'Standard shipment booking and documentation workflow',
    industrySlug: LOG,
    config: {
      description: 'Book a new shipment: rate negotiation, carrier selection, documentation, pickup scheduling, customer confirmation',
      estimatedDuration: '2 hours',
      assignToRole: 'shipment-coordinator',
      subtasks: [
        'Verify shipment details and requirements',
        'Request and compare carrier rates',
        'Select optimal carrier and confirm booking',
        'Prepare shipping documentation and labels',
        'Schedule pickup with origin location',
        'Update TMS with shipment details',
        'Send confirmation and tracking to customer',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'warehouse-receiving',
    name: 'Warehouse Receiving',
    description: 'Standard warehouse receiving and putaway workflow',
    industrySlug: LOG,
    config: {
      description: 'Receive inbound shipment: dock scheduling, unloading, quantity verification, quality inspection, system receipt, putaway',
      estimatedDuration: '4 hours',
      assignToRole: 'warehouse-supervisor',
      subtasks: [
        'Schedule dock appointment and allocate resources',
        'Unload shipment and verify against packing list',
        'Perform quantity count and damage inspection',
        'Log discrepancies and initiate claim if needed',
        'Complete system receipt in WMS',
        'Label and stage items for putaway',
        'Execute putaway to designated storage locations',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'route-optimization',
    name: 'Route Optimisation Review',
    description: 'Periodic route optimisation analysis and re-planning workflow',
    industrySlug: LOG,
    config: {
      description: 'Review and optimise delivery routes: data analysis, constraint review, optimisation run, driver assignment, implementation, monitoring',
      estimatedDuration: '1 week',
      assignToRole: 'logistics-manager',
      subtasks: [
        'Collect and analyse current route performance data',
        'Review customer delivery windows and constraints',
        'Run route optimisation engine with updated data',
        'Validate proposed routes for feasibility',
        'Assign drivers and equipment to optimised routes',
        'Brief drivers on route changes and expectations',
        'Monitor first week performance and fine-tune',
      ],
    },
  },

  // ──────────────────────────────────────────────────────────────────
  // DEPARTMENT_DEFAULTS (4)
  // ──────────────────────────────────────────────────────────────────
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'manufacturing-dept-structure',
    name: 'Manufacturing Department Structure',
    description: 'Default department structure for manufacturing facilities',
    industrySlug: MANUF,
    config: {
      departments: [
        { name: 'Production', roles: ['Quality', 'Scheduler', 'Supervisor', 'Operator'] },
        { name: 'Quality', roles: ['Auditor', 'Inspector', 'Tech'] },
        { name: 'Maintenance', roles: ['Coordinator', 'Tech'] },
        { name: 'Supply Chain', roles: ['Manager', 'Buyer', 'Analyst'] },
        { name: 'Safety', roles: ['Officer', 'Specialist'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'construction-dept-structure',
    name: 'Construction Department Structure',
    description: 'Default department structure for construction and engineering firms',
    industrySlug: CONST,
    config: {
      departments: [
        { name: 'Project Mgmt', roles: ['PM', 'Engineer', 'Coordinator'] },
        { name: 'Site Ops', roles: ['Super', 'Foreman', 'Laborer'] },
        { name: 'Engineering', roles: ['Civil', 'Structural', 'MEP'] },
        { name: 'Compliance', roles: ['Officer', 'Safety Mgr'] },
        { name: 'Procurement', roles: ['Specialist', 'Expeditor'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'energy-dept-structure',
    name: 'Energy Utilities Department Structure',
    description: 'Default department structure for energy and utilities companies',
    industrySlug: ENERGY,
    config: {
      departments: [
        { name: 'Asset Mgmt', roles: ['Manager', 'Engineer'] },
        { name: 'Field Ops', roles: ['Dispatcher', 'Tech', 'Lineman'] },
        { name: 'Outage Mgmt', roles: ['Coordinator', 'Operator'] },
        { name: 'Compliance', roles: ['Manager', 'Officer'] },
        { name: 'Safety', roles: ['Officer', 'Trainer'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'logistics-dept-structure',
    name: 'Logistics Department Structure',
    description: 'Default department structure for logistics and transportation companies',
    industrySlug: LOG,
    config: {
      departments: [
        { name: 'Operations', roles: ['Manager', 'Coordinator', 'Fleet Mgr'] },
        { name: 'Warehouse', roles: ['Supervisor', 'Picker', 'Operator'] },
        { name: 'Transportation', roles: ['Driver', 'Dispatcher', 'Planner'] },
        { name: 'Customer Service', roles: ['Rep', 'Specialist'] },
        { name: 'Admin', roles: ['Manager', 'Assistant'] },
      ],
    },
  },
];

async function seedTemplates() {
  console.log(`\nSeed industrial-infra templates — ${DRY_RUN ? 'DRY RUN (checking only)' : 'WRITING to database'}\n`);

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
