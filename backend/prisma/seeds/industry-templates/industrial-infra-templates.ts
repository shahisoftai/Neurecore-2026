import { TemplateType } from '@prisma/client';

export interface SeedTemplate {
  templateType: TemplateType;
  slug: string;
  name: string;
  description?: string;
  industrySlug: string;
  config: Record<string, unknown>;
}

export const INDUSTRIAL_INFRA_TEMPLATES: SeedTemplate[] = [
  // ═══ MANUFACTURING & INDUSTRIAL ═══
  {
    templateType: 'CUSTOMER_LIFECYCLE',
    slug: 'manufacturing-supplier-lifecycle',
    name: 'Manufacturing Supplier & Customer Lifecycle',
    description: 'Lifecycle for manufacturing: prospect → active supplier/customer → qualified → long-term partner → inactive',
    industrySlug: 'manufacturing-industrial',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'active', label: 'Active Supplier / Customer', order: 2 },
        { key: 'qualified', label: 'Qualified', order: 3 },
        { key: 'long-term-partner', label: 'Long-term Partner', order: 4 },
        { key: 'inactive', label: 'Inactive / Archived', order: 5 },
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
    description: 'Project lifecycle for construction: bid → contract → active delivery → substantial completion → final completion → warranty',
    industrySlug: 'construction-engineering-infrastructure',
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
    description: 'Service lifecycle for energy/utilities: new request → connected → active → maintenance → potential disconnection → closed',
    industrySlug: 'energy-utilities-natural-resources',
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
    description: 'Customer lifecycle for logistics: prospect → contracted → active shipments → long-term partner → renewal/churn',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      stages: [
        { key: 'prospect', label: 'Prospect', order: 1 },
        { key: 'contracted', label: 'Contracted', order: 2 },
        { key: 'active-shipments', label: 'Active Shipments', order: 3 },
        { key: 'long-term-partner', label: 'Long-term Partner', order: 4 },
        { key: 'renewal-churn', label: 'Renewal / Churn', order: 5 },
      ],
      defaultStage: 'prospect',
      customerFieldDefinitions: [
        { key: 'customerType', label: 'Type', type: 'enum', options: ['Shipper', 'Consignee', 'Carrier', 'Broker'] },
        { key: 'shipmentVolume', label: 'Monthly Shipments', type: 'number' },
        { key: 'primaryLane', label: 'Primary Lane', type: 'text' },
      ],
    },
  },
  // ═══ AGENT ROLES ═══
  {
    templateType: 'AGENT_ROLE',
    slug: 'production-scheduler',
    name: 'Production Scheduler',
    industrySlug: 'manufacturing-industrial',
    config: {
      systemPrompt: 'You are a Production Scheduler for a manufacturing company.\nYour role: production planning, capacity allocation, timeline management, shop floor coordination.\nOptimize production sequences. Minimize changeovers. Balance capacity across lines.',
      kpis: [
        { name: 'Schedule adherence', target: '> 95%' },
        { name: 'OEE (Overall Equipment Effectiveness)', target: '> 85%' },
        { name: 'On-time delivery', target: '> 98%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'quality-auditor',
    name: 'Quality Auditor',
    industrySlug: 'manufacturing-industrial',
    config: {
      systemPrompt: 'You are a Quality Auditor for a manufacturing company.\nYour role: inspection, defect documentation, root cause analysis, remediation tracking.\nMaintain quality standards. Document non-conformances. Drive corrective actions. Support certifications.',
      kpis: [
        { name: 'Defect rate', target: '< 1%' },
        { name: 'First-pass yield', target: '> 97%' },
        { name: 'Audit readiness', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'maintenance-coordinator',
    name: 'Maintenance Coordinator',
    industrySlug: 'manufacturing-industrial',
    config: {
      systemPrompt: 'You are a Maintenance Coordinator for a manufacturing company.\nYour role: maintenance scheduling, work order management, asset tracking, spare parts inventory.\nPlan preventive maintenance. Respond to breakdowns. Track equipment history. Manage MRO inventory.',
      kpis: [
        { name: 'PM compliance', target: '> 95%' },
        { name: 'MTBF (Mean Time Between Failures)', target: 'Increasing' },
        { name: 'Maintenance cost per unit', target: 'Decreasing' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'supply-chain-manager',
    name: 'Supply Chain Manager',
    industrySlug: 'manufacturing-industrial',
    config: {
      systemPrompt: 'You are a Supply Chain Manager for a manufacturing company.\nYour role: supplier management, inventory optimization, procurement, logistics coordination.\nEvaluate suppliers. Optimize inventory levels. Negotiate contracts. Ensure material availability.',
      kpis: [
        { name: 'Supplier on-time delivery', target: '> 95%' },
        { name: 'Inventory turns', target: '> 6x per year' },
        { name: 'Procurement cost savings', target: '> 5% YoY' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'safety-officer',
    name: 'Safety Officer',
    industrySlug: 'manufacturing-industrial',
    config: {
      systemPrompt: 'You are a Safety Officer for a manufacturing company.\nYour role: safety compliance, incident tracking, training, corrective actions.\nEnforce safety protocols. Investigate incidents. Conduct safety training. Maintain OSHA compliance.',
      kpis: [
        { name: 'Incident rate', target: '< 1 per 100 workers' },
        { name: 'Safety training completion', target: '100%' },
        { name: 'Corrective action closure', target: '< 30 days' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'construction-pm',
    name: 'Construction Project Manager',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      systemPrompt: 'You are a Construction Project Manager.\nYour role: project planning, schedule management, budget control, stakeholder coordination.\nManage project lifecycle. Coordinate subcontractors. Ensure safety compliance. Track progress against milestones.',
      kpis: [
        { name: 'Schedule variance', target: '< 5%' },
        { name: 'Budget variance', target: '< 3%' },
        { name: 'Safety incidents', target: '0' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'site-superintendent',
    name: 'Site Superintendent',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      systemPrompt: 'You are a Site Superintendent.\nYour role: daily operations, quality control, safety enforcement, subcontractor management.\nOversee site activities. Enforce quality standards. Manage daily logs. Coordinate material deliveries.',
      kpis: [
        { name: 'Daily progress vs plan', target: '> 95%' },
        { name: 'Rework rate', target: '< 2%' },
        { name: 'Safety violations', target: '0' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'civil-engineer',
    name: 'Civil/Structural Engineer',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      systemPrompt: 'You are a Civil/Structural Engineer.\nYour role: technical design, compliance review, inspections, problem-solving.\nReview designs for compliance. Conduct site inspections. Resolve technical issues. Ensure code adherence.',
      kpis: [
        { name: 'Design review turnaround', target: '< 5 days' },
        { name: 'Inspection pass rate', target: '> 95%' },
        { name: 'RFI response time', target: '< 48 hours' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-officer-construction',
    name: 'Construction Compliance Officer',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      systemPrompt: 'You are a Compliance Officer for a construction company.\nYour role: permits, inspections, safety regulations, environmental compliance.\nTrack permit applications. Schedule inspections. Ensure regulatory alignment. Document compliance.',
      kpis: [
        { name: 'Permit approval rate', target: '> 95%' },
        { name: 'Inspection pass rate', target: 'First time > 90%' },
        { name: 'Compliance documentation', target: '100% complete' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'procurement-specialist',
    name: 'Procurement Specialist',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      systemPrompt: 'You are a Procurement Specialist for a construction company.\nYour role: vendor selection, subcontractor management, material ordering, cost control.\nSource materials competitively. Qualify subcontractors. Track orders. Manage material budgets.',
      kpis: [
        { name: 'Cost savings', target: '> 5% vs budget' },
        { name: 'Material on-time delivery', target: '> 95%' },
        { name: 'Vendor performance score', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'asset-manager-energy',
    name: 'Asset Manager',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      systemPrompt: 'You are an Asset Manager for an energy/utilities company.\nYour role: asset inventory, maintenance planning, lifecycle tracking, replacement planning.\nTrack asset condition. Plan capital replacements. Optimize maintenance strategies. Ensure regulatory compliance.',
      kpis: [
        { name: 'Asset availability', target: '> 99%' },
        { name: 'Maintenance cost per asset', target: 'Within budget' },
        { name: 'Asset lifecycle compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'outage-coordinator',
    name: 'Outage Coordinator',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      systemPrompt: 'You are an Outage Coordinator for an energy/utilities company.\nYour role: incident response, dispatch, restoration tracking, customer communication.\nCoordinate outage response. Dispatch field crews. Track restoration progress. Update affected customers.',
      kpis: [
        { name: 'Mean time to restore', target: '< 2 hours' },
        { name: 'Customer notification time', target: '< 15 minutes' },
        { name: 'Restoration accuracy', target: '> 95%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'compliance-manager-energy',
    name: 'Compliance Manager',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      systemPrompt: 'You are a Compliance Manager for an energy/utilities company.\nYour role: regulatory tracking, reporting, audit preparation, environmental compliance.\nMonitor regulatory changes. Prepare compliance reports. Manage audits. Track corrective actions.',
      kpis: [
        { name: 'Regulatory filing on time', target: '100%' },
        { name: 'Audit findings', target: '0 major' },
        { name: 'Environmental compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'technician-dispatcher',
    name: 'Technician Dispatcher',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      systemPrompt: 'You are a Technician Dispatcher for an energy/utilities company.\nYour role: work order assignment, field tracking, completion verification, resource optimization.\nDispatch technicians efficiently. Track field status. Verify work completion. Optimize routes.',
      kpis: [
        { name: 'Dispatch response time', target: '< 5 minutes' },
        { name: 'First-time fix rate', target: '> 85%' },
        { name: 'Travel time efficiency', target: 'Optimized daily' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'environmental-safety-officer',
    name: 'Environmental & Safety Officer',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      systemPrompt: 'You are an Environmental & Safety Officer for an energy/utilities company.\nYour role: environmental compliance, incident investigation, corrective action, safety training.\nMonitor environmental impact. Investigate incidents. Drive safety culture. Ensure regulatory compliance.',
      kpis: [
        { name: 'Environmental incidents', target: '0' },
        { name: 'Safety training completion', target: '100%' },
        { name: 'Permit compliance', target: '100%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'logistics-manager',
    name: 'Logistics Manager',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      systemPrompt: 'You are a Logistics Manager for a transportation company.\nYour role: route planning, carrier management, cost optimization, service quality.\nOptimize transportation networks. Manage carrier relationships. Control costs. Ensure on-time delivery.',
      kpis: [
        { name: 'On-time delivery', target: '> 98%' },
        { name: 'Cost per shipment', target: 'Decreasing YoY' },
        { name: 'Carrier performance', target: '> 4/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'shipment-coordinator',
    name: 'Shipment Coordinator',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      systemPrompt: 'You are a Shipment Coordinator for a logistics company.\nYour role: booking, tracking, delivery confirmation, issue resolution.\nManage shipment lifecycle. Track in real-time. Resolve exceptions. Confirm deliveries.',
      kpis: [
        { name: 'Shipment accuracy', target: '> 99%' },
        { name: 'Exception resolution time', target: '< 2 hours' },
        { name: 'Customer satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'warehouse-supervisor',
    name: 'Warehouse Supervisor',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      systemPrompt: 'You are a Warehouse Supervisor for a logistics company.\nYour role: receiving, inventory management, picking, packing, quality control.\nManage warehouse operations. Optimize layout. Ensure accuracy. Maintain safety standards.',
      kpis: [
        { name: 'Order accuracy', target: '> 99.5%' },
        { name: 'Picking productivity', target: '> target rate' },
        { name: 'Inventory accuracy', target: '> 99%' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'driver-operator',
    name: 'Driver / Operator',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      systemPrompt: 'You are a Driver/Operator for a logistics company.\nYour role: real-time tracking, proof of delivery, customer interaction, vehicle care.\nComplete deliveries on time. Document deliveries accurately. Provide excellent service. Maintain vehicle.',
      kpis: [
        { name: 'On-time delivery', target: '> 99%' },
        { name: 'Delivery documentation', target: '100% complete' },
        { name: 'Customer rating', target: '> 4.5/5' },
      ],
    },
  },
  {
    templateType: 'AGENT_ROLE',
    slug: 'logistics-customer-service',
    name: 'Customer Service Representative',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      systemPrompt: 'You are a Customer Service Representative for a logistics company.\nYour role: shipment inquiry, issue escalation, resolution tracking, customer communication.\nHandle tracking inquiries. Escalate exceptions. Communicate delays proactively. Ensure customer satisfaction.',
      kpis: [
        { name: 'Inquiry resolution time', target: '< 15 minutes' },
        { name: 'First contact resolution', target: '> 80%' },
        { name: 'Customer satisfaction', target: '> 4.5/5' },
      ],
    },
  },
  // ═══ ROUTINES ═══
  {
    templateType: 'ROUTINE',
    slug: 'daily-production-standup',
    name: 'Daily Production Standup Report',
    industrySlug: 'manufacturing-industrial',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Generate daily production plan: scheduled runs, changeovers, staffing, material availability. Highlight risks.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-quality-review',
    name: 'Weekly Quality Review',
    industrySlug: 'manufacturing-industrial',
    config: {
      trigger: 'time: Friday 2:00 PM',
      action: 'Review quality metrics for the week: defect rates, first-pass yield, scrap, rework. Flag trends.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-site-safety-briefing',
    name: 'Daily Site Safety Briefing',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      trigger: 'time: 6:30 AM daily',
      action: 'Generate daily safety briefing: current hazards, PPE requirements, weather alerts, emergency procedures.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-permit-status',
    name: 'Weekly Permit Status Check',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      trigger: 'time: Monday 8:00 AM',
      action: 'Check status of all active permits. Flag expiring or delayed permits. Schedule inspections.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-outage-briefing',
    name: 'Daily Outage Status Briefing',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      trigger: 'time: 8:00 AM daily',
      action: 'Summarize all active outages: count, affected customers, restoration ETA, crew status.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'monthly-compliance-review',
    name: 'Monthly Regulatory Compliance Review',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      trigger: 'time: 5th of month 9:00 AM',
      action: 'Review regulatory filings due this month. Check compliance documentation. Flag gaps.',
      channels: ['in-app', 'email'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'daily-shipment-status',
    name: 'Daily Shipment Status Update',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      trigger: 'time: 7:00 AM daily',
      action: 'Summarize all active shipments: on-time, delayed, exceptions. Highlight priority shipments.',
      channels: ['in-app'],
    },
  },
  {
    templateType: 'ROUTINE',
    slug: 'weekly-fleet-maintenance-check',
    name: 'Weekly Fleet Maintenance Check',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      trigger: 'time: Monday 7:00 AM',
      action: 'Review fleet maintenance schedule. Flag vehicles due for service. Track overdue maintenance.',
      channels: ['in-app'],
    },
  },
  // ═══ REPORTS ═══
  {
    templateType: 'REPORT',
    slug: 'production-efficiency-dashboard',
    name: 'Production Efficiency Dashboard',
    industrySlug: 'manufacturing-industrial',
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
    industrySlug: 'manufacturing-industrial',
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
    industrySlug: 'construction-engineering-infrastructure',
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
    industrySlug: 'construction-engineering-infrastructure',
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
    industrySlug: 'energy-utilities-natural-resources',
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
    industrySlug: 'energy-utilities-natural-resources',
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
    industrySlug: 'logistics-transportation-supply-chain',
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
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      metrics: ['fleetUtilization', 'fuelEfficiency', 'maintenanceCost', 'idleTime', 'driverUtilization'],
      period: 'monthly',
      format: 'dashboard',
    },
  },
  // ═══ TASK TEMPLATES ═══
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'production-run-setup',
    name: 'Production Run Setup',
    industrySlug: 'manufacturing-industrial',
    config: {
      description: 'Set up a production run: material staging, line preparation, quality checks, scheduling',
      estimatedDuration: '1 day',
      assignToRole: 'production-scheduler',
      subtasks: [
        'Verify material availability',
        'Stage raw materials at line',
        'Complete line changeover',
        'Conduct pre-production quality check',
        'Brief production team',
        'Start production and monitor first piece',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'root-cause-analysis',
    name: 'Root Cause Analysis (Quality)',
    industrySlug: 'manufacturing-industrial',
    config: {
      description: 'Conduct root cause analysis for a quality defect or non-conformance',
      estimatedDuration: '3 days',
      assignToRole: 'quality-auditor',
      subtasks: [
        'Define the problem statement',
        'Collect data and evidence',
        'Create fishbone / Ishikawa diagram',
        'Identify root cause using 5 Whys',
        'Develop corrective action plan',
        'Implement corrective actions',
        'Verify effectiveness',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'pm-work-order',
    name: 'Preventive Maintenance Work Order',
    industrySlug: 'manufacturing-industrial',
    config: {
      description: 'Execute a preventive maintenance work order on equipment',
      estimatedDuration: '4 hours',
      assignToRole: 'maintenance-coordinator',
      subtasks: [
        'Review equipment history and PM checklist',
        'Lock out and tag out equipment',
        'Perform PM tasks per checklist',
        'Document findings and measurements',
        'Replace worn parts as needed',
        'Test equipment operation',
        'Close work order and update records',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'site-preparation',
    name: 'Construction Site Preparation',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      description: 'Prepare a construction site for project start: mobilization, safety, utilities, layout',
      estimatedDuration: '1 week',
      assignToRole: 'site-superintendent',
      subtasks: [
        'Complete site survey and layout',
        'Set up site security and fencing',
        'Install temporary utilities',
        'Set up site offices and facilities',
        'Conduct safety orientation',
        'Mobilize equipment and materials',
        'Post required permits and signage',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'inspection-preparation',
    name: 'Building Inspection Preparation',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      description: 'Prepare for a building code inspection',
      estimatedDuration: '2 days',
      assignToRole: 'construction-pm',
      subtasks: [
        'Review inspection checklist for phase',
        'Verify all work meets code requirements',
        'Collect required documentation',
        'Conduct pre-inspection walkthrough',
        'Address any deficiencies found',
        'Schedule official inspection',
        'Attend inspection and document results',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'outage-restoration',
    name: 'Outage Restoration Procedure',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      description: 'Execute an outage restoration: detection, dispatch, repair, restoration, communication',
      estimatedDuration: '4 hours',
      assignToRole: 'outage-coordinator',
      subtasks: [
        'Detect and verify outage scope',
        'Dispatch assessment crew',
        'Notify affected customers',
        'Isolate fault and restore unaffected areas',
        'Repair fault',
        'Restore all service',
        'Document incident and root cause',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'regulatory-filing',
    name: 'Regulatory Filing Preparation',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      description: 'Prepare and submit a regulatory compliance filing',
      estimatedDuration: '2 weeks',
      assignToRole: 'compliance-manager-energy',
      subtasks: [
        'Identify filing requirements and deadline',
        'Collect required data and metrics',
        'Draft filing document',
        'Internal legal and technical review',
        'Obtain executive approval',
        'Submit filing to regulatory body',
        'File confirmation and archive',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'shipment-booking',
    name: 'Shipment Booking & Dispatch',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      description: 'Book and dispatch a shipment: booking, carrier assignment, documentation, tracking',
      estimatedDuration: '2 hours',
      assignToRole: 'shipment-coordinator',
      subtasks: [
        'Receive shipment request and verify details',
        'Select optimal carrier and rate',
        'Book shipment with carrier',
        'Generate shipping documents',
        'Schedule pickup',
        'Set up tracking',
        'Confirm booking with customer',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'warehouse-receiving',
    name: 'Warehouse Receiving Process',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      description: 'Receive and process inbound goods: inspection, documentation, putaway',
      estimatedDuration: '4 hours',
      assignToRole: 'warehouse-supervisor',
      subtasks: [
        'Verify shipment against purchase order',
        'Inspect goods for damage',
        'Count and confirm quantities',
        'Update inventory system',
        'Label and tag items',
        'Assign storage location',
        'Complete putaway',
      ],
    },
  },
  {
    templateType: 'TASK_TEMPLATE',
    slug: 'route-optimization',
    name: 'Route Optimization Review',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      description: 'Optimize delivery routes: analyze, redesign, implement, measure',
      estimatedDuration: '1 week',
      assignToRole: 'logistics-manager',
      subtasks: [
        'Analyze current route performance',
        'Identify inefficiencies and bottlenecks',
        'Design optimized route plan',
        'Validate with driver input',
        'Update route assignments',
        'Brief drivers on changes',
        'Monitor first-week results',
      ],
    },
  },
  // ═══ DEPARTMENT STRUCTURES ═══
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'manufacturing-dept-structure',
    name: 'Manufacturing Department Structure',
    industrySlug: 'manufacturing-industrial',
    config: {
      departments: [
        { name: 'Production', roles: ['Production Scheduler', 'Production Supervisor', 'Machine Operator'] },
        { name: 'Quality', roles: ['Quality Auditor', 'QC Inspector', 'Lab Technician'] },
        { name: 'Maintenance', roles: ['Maintenance Coordinator', 'Maintenance Technician'] },
        { name: 'Supply Chain', roles: ['Supply Chain Manager', 'Buyer', 'Inventory Analyst'] },
        { name: 'Safety', roles: ['Safety Officer', 'EHS Specialist'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'construction-dept-structure',
    name: 'Construction Department Structure',
    industrySlug: 'construction-engineering-infrastructure',
    config: {
      departments: [
        { name: 'Project Management', roles: ['Construction PM', 'Project Engineer', 'Project Coordinator'] },
        { name: 'Site Operations', roles: ['Site Superintendent', 'Foreman', 'Laborer'] },
        { name: 'Engineering', roles: ['Civil Engineer', 'Structural Engineer', 'MEP Engineer'] },
        { name: 'Compliance', roles: ['Compliance Officer', 'Safety Manager'] },
        { name: 'Procurement', roles: ['Procurement Specialist', 'Expeditor'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'energy-dept-structure',
    name: 'Energy & Utilities Department Structure',
    industrySlug: 'energy-utilities-natural-resources',
    config: {
      departments: [
        { name: 'Asset Management', roles: ['Asset Manager', 'Reliability Engineer'] },
        { name: 'Field Operations', roles: ['Technician Dispatcher', 'Field Technician', 'Lineman'] },
        { name: 'Outage Management', roles: ['Outage Coordinator', 'System Operator'] },
        { name: 'Compliance', roles: ['Compliance Manager', 'Environmental Officer'] },
        { name: 'Safety', roles: ['Safety Officer', 'Safety Trainer'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
  {
    templateType: 'DEPARTMENT_DEFAULT',
    slug: 'logistics-dept-structure',
    name: 'Logistics & Transportation Department Structure',
    industrySlug: 'logistics-transportation-supply-chain',
    config: {
      departments: [
        { name: 'Operations', roles: ['Logistics Manager', 'Shipment Coordinator', 'Fleet Manager'] },
        { name: 'Warehouse', roles: ['Warehouse Supervisor', 'Picker/Packer', 'Forklift Operator'] },
        { name: 'Transportation', roles: ['Driver', 'Dispatcher', 'Route Planner'] },
        { name: 'Customer Service', roles: ['Customer Service Rep', 'Claims Specialist'] },
        { name: 'Administration', roles: ['Office Manager', 'Executive Assistant'] },
      ],
    },
  },
];
