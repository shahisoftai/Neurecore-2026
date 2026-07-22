/**
 * industryNavigation.ts
 *
 * INDUSTRY-GROUPS-CONCEPT.md §7 — 80/20 navigation principle.
 *
 * 80% of the IconRail is identical across all Industries.
 * Only the Workspace section's "extras" and the Customers section's
 * label/icon change per Industry Group.
 *
 * This file defines the per-group navigation config.
 * The IconRail reads from this and injects industry-specific items.
 */

export interface RailItem {
  id: string;
  label: string;
  href: string;
  iconName: string; // lucide-react icon name (resolved by IconRail)
}

export interface IndustryNavConfig {
  groupSlug: string;
  /** Items appended to the Workspace section. */
  workspaceExtras: RailItem[];
  /** Customers section label override (null = keep default "Customers"). */
  customersLabel: string | null;
  /** Customers section icon override (null = keep default). */
  customersIcon: string | null;
}

/** Default fallback (when tenant has no industryGroup). */
const FALLBACK: IndustryNavConfig = {
  groupSlug: 'default',
  workspaceExtras: [],
  customersLabel: null,
  customersIcon: null,
};

/** Per-group configuration — first vertical (Financial & Compliance) is fully wired. */
export const INDUSTRY_NAV_CONFIGS: Record<string, IndustryNavConfig> = {
  'financial-compliance': {
    groupSlug: 'financial-compliance',
    customersLabel: 'Clients & Accounts',
    customersIcon: 'Landmark',
    workspaceExtras: [
      { id: 'engagements',  label: 'Engagements',  href: '/workspace/engagements',  iconName: 'Briefcase' },
      { id: 'loans',        label: 'Loans',        href: '/workspace/loans',        iconName: 'Landmark' },
      { id: 'portfolios',   label: 'Portfolios',   href: '/workspace/portfolios',   iconName: 'PieChart' },
      { id: 'audits',       label: 'Audits',       href: '/workspace/audits',       iconName: 'ClipboardCheck' },
      { id: 'tax',          label: 'Tax',          href: '/workspace/tax',          iconName: 'Receipt' },
      { id: 'payroll',      label: 'Payroll',      href: '/workspace/payroll',      iconName: 'Wallet' },
      { id: 'compliance',   label: 'Compliance',   href: '/workspace/compliance',   iconName: 'ShieldCheck' },
      { id: 'risk',         label: 'Risk',         href: '/workspace/risk',         iconName: 'AlertTriangle' },
    ],
  },

  healthcare: {
    groupSlug: 'healthcare',
    customersLabel: 'Patients',
    customersIcon: 'Stethoscope',
    workspaceExtras: [
      { id: 'appointments',     label: 'Appointments',     href: '/workspace/appointments',     iconName: 'Calendar' },
      { id: 'medical-records',  label: 'Medical Records',  href: '/workspace/medical-records',  iconName: 'FileText' },
      { id: 'pharmacy',         label: 'Pharmacy',         href: '/workspace/pharmacy',         iconName: 'Pill' },
      { id: 'laboratory',       label: 'Laboratory',       href: '/workspace/laboratory',       iconName: 'TestTube' },
    ],
  },

  'public-social': {
    groupSlug: 'public-social',
    customersLabel: 'Citizens & Beneficiaries',
    customersIcon: 'Users',
    workspaceExtras: [
      { id: 'programs',          label: 'Programs',          href: '/workspace/programs',          iconName: 'FolderKanban' },
      { id: 'grants',            label: 'Grants',            href: '/workspace/grants',            iconName: 'DollarSign' },
      { id: 'field-operations',  label: 'Field Operations',  href: '/workspace/field-operations',  iconName: 'MapPin' },
      { id: 'cases',             label: 'Cases',             href: '/workspace/cases',             iconName: 'Briefcase' },
      { id: 'licenses',          label: 'Licenses',          href: '/workspace/licenses',          iconName: 'FileBadge' },
      { id: 'inspections',       label: 'Inspections',       href: '/workspace/inspections',       iconName: 'ClipboardCheck' },
    ],
  },

  'business-technology': {
    groupSlug: 'business-technology',
    customersLabel: 'Clients',
    customersIcon: 'UserCircle',
    workspaceExtras: [
      { id: 'tickets',     label: 'Tickets',     href: '/workspace/tickets',     iconName: 'Ticket' },
      { id: 'releases',    label: 'Releases',    href: '/workspace/releases',    iconName: 'Rocket' },
      { id: 'contracts',  label: 'Contracts',   href: '/workspace/contracts',   iconName: 'FileSignature' },
      { id: 'knowledge',   label: 'Knowledge',   href: '/workspace/knowledge',   iconName: 'BookOpen' },
    ],
  },

  'industrial-infrastructure': {
    groupSlug: 'industrial-infrastructure',
    customersLabel: 'Customers & Suppliers',
    customersIcon: 'Truck',
    workspaceExtras: [
      { id: 'sites',       label: 'Sites',       href: '/workspace/sites',       iconName: 'MapPin' },
      { id: 'production',  label: 'Production',  href: '/workspace/production',  iconName: 'Factory' },
      { id: 'work-orders', label: 'Work Orders', href: '/workspace/work-orders', iconName: 'Wrench' },
      { id: 'equipment',   label: 'Equipment',   href: '/workspace/equipment',   iconName: 'Cog' },
      { id: 'shipments',   label: 'Shipments',   href: '/workspace/shipments',   iconName: 'Package' },
      { id: 'fleet',       label: 'Fleet',       href: '/workspace/fleet',       iconName: 'Truck' },
      { id: 'warehouses',  label: 'Warehouses',  href: '/workspace/warehouses',  iconName: 'Warehouse' },
    ],
  },

  'consumer-commerce': {
    groupSlug: 'consumer-commerce',
    customersLabel: 'Customers & Members',
    customersIcon: 'Heart',
    workspaceExtras: [
      { id: 'products',    label: 'Products',    href: '/workspace/products',    iconName: 'Box' },
      { id: 'orders',      label: 'Orders',      href: '/workspace/orders',      iconName: 'ShoppingCart' },
      { id: 'inventory',   label: 'Inventory',   href: '/workspace/inventory',   iconName: 'Package' },
      { id: 'stores',      label: 'Stores',      href: '/workspace/stores',      iconName: 'Store' },
      { id: 'promotions',  label: 'Promotions',  href: '/workspace/promotions',  iconName: 'Tag' },
      { id: 'campaigns',   label: 'Campaigns',   href: '/workspace/campaigns',   iconName: 'Megaphone' },
      { id: 'content',     label: 'Content',     href: '/workspace/content',     iconName: 'FileEdit' },
    ],
  },

  'agriculture-food': {
    groupSlug: 'agriculture-food',
    customersLabel: 'Buyers & Suppliers',
    customersIcon: 'Tractor',
    workspaceExtras: [
      { id: 'farms',        label: 'Farms',        href: '/workspace/farms',        iconName: 'Map' },
      { id: 'fields',       label: 'Fields',       href: '/workspace/fields',       iconName: 'LayoutGrid' },
      { id: 'livestock',    label: 'Livestock',    href: '/workspace/livestock',    iconName: 'Beef' },
      { id: 'production',   label: 'Production',   href: '/workspace/production',   iconName: 'Factory' },
      { id: 'inventory',    label: 'Inventory',    href: '/workspace/inventory',    iconName: 'Package' },
    ],
  },

  other: {
    groupSlug: 'other',
    customersLabel: 'Organizations',
    customersIcon: 'Users',
    workspaceExtras: [
      { id: 'operations',  label: 'Operations',  href: '/workspace/operations',  iconName: 'Activity' },
      { id: 'assets',      label: 'Assets',      href: '/workspace/assets',      iconName: 'Briefcase' },
      { id: 'documents',   label: 'Documents',   href: '/workspace/documents',   iconName: 'FileText' },
      { id: 'custom',      label: 'Custom Modules', href: '/workspace/custom',   iconName: 'PlusSquare' },
    ],
  },
};

/**
 * Resolve the nav config for a given industry group slug.
 * Returns the FALLBACK config if the slug is unknown.
 */
export function getIndustryNavConfig(groupSlug: string | null | undefined): IndustryNavConfig {
  if (!groupSlug) return FALLBACK;
  return INDUSTRY_NAV_CONFIGS[groupSlug] ?? FALLBACK;
}
