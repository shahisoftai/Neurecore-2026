/**
 * Agent Bio Generator - Creates random but contextually appropriate
 * bios, designations, and profile data for agents based on their
 * template type and department context.
 */

interface GeneratedProfile {
  designation: string;
  bio: string;
  color: string;
  emoji: string;
}

const DESIGNATIONS: Record<string, string[]> = {
  EXECUTIVE: [
    'Chief Executive', 'VP of Operations', 'Senior Director', 'Head of Division',
    'Executive Lead', 'Strategic Leader', 'Principal Officer', 'Senior Vice President',
  ],
  FUNCTIONAL: [
    'Senior Specialist', 'Lead Analyst', 'Principal Consultant', 'Staff Engineer',
    'Senior Associate', 'Professional Lead', 'Expert Practitioner', 'Senior Manager',
  ],
  CORE: [
    'Associate', 'Analyst', 'Specialist', 'Coordinator', 'Assistant', 'Junior Professional',
  ],
  META: [
    'Oversight Lead', 'Governance Specialist', 'Strategy Consultant', 'Advisory Lead',
  ],
};

const BIOS_BY_CATEGORY: Record<string, string[]> = {
  FINANCE: [
    'Experienced finance professional with expertise in financial analysis, reporting, and strategic planning.',
    'Detail-oriented financial specialist focused on accuracy, compliance, and actionable insights.',
    'Finance expert skilled in budget management, forecasting, and stakeholder communication.',
    'Strategic finance partner with deep knowledge of financial operations and controls.',
    'Results-driven finance professional committed to data-driven decision making.',
  ],
  ACCOUNTING: [
    'Accounting professional with strong attention to detail and regulatory compliance expertise.',
    'Experienced accountant specializing in general ledger, reconciliation, and financial reporting.',
    'Accounting specialist focused on accuracy, timeliness, and process optimization.',
    'Detail-driven accounting professional with expertise in multiple accounting standards.',
    'Accounting expert committed to integrity, accuracy, and continuous improvement.',
  ],
  HR: [
    'HR professional dedicated to building high-performing teams and fostering workplace culture.',
    'People operations specialist with expertise in talent acquisition and employee development.',
    'HR leader focused on strategic workforce planning and employee experience.',
    'Human resources professional committed to diversity, equity, and inclusion.',
    'HR specialist skilled in employee relations, benefits, and compliance.',
  ],
  SALES: [
    'Results-oriented sales professional with a track record of exceeding targets.',
    'Sales specialist focused on building client relationships and driving revenue growth.',
    'Strategic sales leader with expertise in consultative selling and account management.',
    'Sales professional passionate about understanding customer needs and delivering solutions.',
    'Revenue-focused sales specialist with strong negotiation and presentation skills.',
  ],
  MARKETING: [
    'Creative marketing professional with expertise in digital campaigns and brand development.',
    'Marketing specialist focused on data-driven strategies and audience engagement.',
    'Brand strategist with a passion for storytelling and market positioning.',
    'Marketing leader skilled in campaign management, analytics, and content strategy.',
    'Growth-oriented marketing professional with expertise in demand generation.',
  ],
  ENGINEERING: [
    'Engineering professional dedicated to building scalable, reliable systems.',
    'Software engineer focused on clean code, testing, and continuous improvement.',
    'Technical leader with expertise in architecture, performance, and best practices.',
    'Engineering specialist committed to DevOps, automation, and operational excellence.',
    'Technology professional skilled in full-stack development and system design.',
  ],
  OPERATIONS: [
    'Operations professional focused on efficiency, quality, and process optimization.',
    'Operations specialist with expertise in supply chain, logistics, and fulfillment.',
    'Process improvement leader dedicated to operational excellence and cost reduction.',
    'Operations expert skilled in planning, execution, and performance management.',
    'Operations leader committed to continuous improvement and stakeholder satisfaction.',
  ],
  RISK: [
    'Risk professional dedicated to identifying, assessing, and mitigating organizational risks.',
    'Risk management specialist focused on compliance, controls, and governance.',
    'Risk analyst with expertise in quantitative analysis and risk modeling.',
    'Risk leader committed to protecting organizational assets and reputation.',
    'Compliance professional skilled in regulatory affairs and risk assessment.',
  ],
  LEGAL: [
    'Legal professional providing strategic counsel and regulatory guidance.',
    'Legal specialist focused on contract management, compliance, and risk mitigation.',
    'In-house counsel skilled in corporate law, contracts, and regulatory matters.',
    'Legal expert committed to protecting organizational interests and ensuring compliance.',
    'Corporate attorney with expertise in governance, contracts, and legal operations.',
  ],
  IT: [
    'IT professional dedicated to enabling business objectives through technology.',
    'Technology specialist focused on infrastructure, security, and user support.',
    'IT leader skilled in strategic planning, vendor management, and digital transformation.',
    'Technical professional committed to innovation, security, and operational excellence.',
    'IT specialist with expertise in systems administration, networking, and support.',
  ],
  DATA: [
    'Data professional transforming information into actionable business insights.',
    'Data analyst focused on statistical analysis, visualization, and reporting.',
    'Data science specialist committed to evidence-based decision making and innovation.',
    'Analytics leader skilled in machine learning, statistics, and business intelligence.',
    'Data engineering professional dedicated to data quality, architecture, and pipelines.',
  ],
  CUSTOMER_SUCCESS: [
    'Customer success professional committed to client satisfaction and retention.',
    'Client success specialist focused on onboarding, engagement, and value realization.',
    'Account manager dedicated to building long-term customer relationships.',
    'Customer advocate skilled in support, training, and stakeholder management.',
    'Client services professional focused on renewals, upsells, and satisfaction.',
  ],
  GENERAL: [
    'Versatile professional with strong analytical and communication skills.',
    'Results-oriented team player committed to excellence and continuous learning.',
    'Experienced professional skilled in multiple domains and business functions.',
    'Strategic thinker with expertise in problem-solving and stakeholder management.',
    'Adaptive professional dedicated to achieving organizational objectives.',
  ],
};

const COLORS = ['blue', 'purple', 'green', 'teal', 'indigo', 'orange', 'pink'];
const EMOJIS: Record<string, string[]> = {
  EXECUTIVE: ['💼', '🎯', '📊', '🏆', '⭐', '👔'],
  FUNCTIONAL: ['⚡', '🔧', '📈', '💡', '🎯', '⚙️'],
  CORE: ['📝', '📋', '✅', '🔔', '📌', '💭'],
  META: ['🔮', '⚖️', '📋', '🎓', '🔍'],
  FINANCE: ['💰', '📊', '💵', '🏦', '📈', '💹'],
  ACCOUNTING: ['🧾', '📑', '🔢', '💹', '📒', '🧮'],
  HR: ['👥', '🤝', '💼', '🎓', '🧑‍💼', '🏢'],
  SALES: ['🤝', '📞', '💪', '🎯', '📈', '💰'],
  MARKETING: ['📣', '🎨', '📱', '📊', '🎯', '📧'],
  ENGINEERING: ['⚙️', '🔧', '💻', '🖥️', '🔌', '⚡'],
  OPERATIONS: ['⚡', '🚀', '📦', '🏭', '🔄', '📊'],
  RISK: ['🛡️', '⚠️', '🔒', '📋', '🔍', '⚖️'],
  LEGAL: ['⚖️', '📜', '🔏', '💼', '📋', '🏛️'],
  IT: ['🖥️', '🔧', '🌐', '🔐', '💾', '⚡'],
  DATA: ['📊', '🔢', '📈', '💾', '🔍', '📉'],
  CUSTOMER_SUCCESS: ['😊', '🤝', '💯', '🎉', '⭐', '📞'],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function categorizeByName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('finance') || lower.includes('budget') || lower.includes('treasury')) return 'FINANCE';
  if (lower.includes('account') || lower.includes('payroll') || lower.includes('tax') || lower.includes('audit')) return 'ACCOUNTING';
  if (lower.includes('hr') || lower.includes('human resource') || lower.includes('people') || lower.includes('recruit')) return 'HR';
  if (lower.includes('sale') || lower.includes('account manager') || lower.includes('client')) return 'SALES';
  if (lower.includes('market') || lower.includes('brand') || lower.includes('campaign') || lower.includes('pr ')) return 'MARKETING';
  if (lower.includes('engineer') || lower.includes('devops') || lower.includes('architect') || lower.includes('software')) return 'ENGINEERING';
  if (lower.includes('operat') || lower.includes('supply') || lower.includes('logistic') || lower.includes('fulfill')) return 'OPERATIONS';
  if (lower.includes('risk') || lower.includes('complian') || lower.includes('govern')) return 'RISK';
  if (lower.includes('legal') || lower.includes('counsel') || lower.includes('contract')) return 'LEGAL';
  if (lower.includes('it ') || lower.includes('tech') || lower.includes('infrastructure') || lower.includes('support')) return 'IT';
  if (lower.includes('data') || lower.includes('analyst') || lower.includes('science') || lower.includes('analytics')) return 'DATA';
  if (lower.includes('customer') || lower.includes('success') || lower.includes('support')) return 'CUSTOMER_SUCCESS';
  return 'GENERAL';
}

function getAgentType(name: string, type?: string): string {
  if (type === 'EXECUTIVE') return 'EXECUTIVE';
  if (type === 'CORE') return 'CORE';
  if (type === 'META') return 'META';
  if (type === 'FUNCTIONAL') return 'FUNCTIONAL';
  const lower = name.toLowerCase();
  if (lower.includes('chief') || lower.includes('vp ') || lower.includes('vice president') || lower.includes('senior director') || lower.includes('head of')) return 'EXECUTIVE';
  if (lower.includes('lead') || lower.includes('senior') || lower.includes('principal') || lower.includes('staff')) return 'FUNCTIONAL';
  return 'FUNCTIONAL';
}

/**
 * Generate a contextually appropriate random profile for an agent.
 * @param agentName - The name of the agent (used to infer context)
 * @param agentType - Optional explicit agent type (EXECUTIVE, FUNCTIONAL, etc.)
 */
export function generateAgentProfile(agentName: string, agentType?: string): GeneratedProfile {
  const category = categorizeByName(agentName);
  const type = getAgentType(agentName, agentType);
  const bios = BIOS_BY_CATEGORY[category] ?? BIOS_BY_CATEGORY.GENERAL;
  const emojis = EMOJIS[category] ?? EMOJIS.GENERAL;

  const designationBase = pickRandom(DESIGNATIONS[type] ?? DESIGNATIONS.FUNCTIONAL);
  const namePart = agentName.split(' ').slice(0, 2).join(' ');

  return {
    designation: `${designationBase}, ${namePart}`,
    bio: pickRandom(bios),
    color: pickRandom(COLORS),
    emoji: pickRandom(emojis),
  };
}

export const AGENT_PROFILE_COLORS = COLORS;
