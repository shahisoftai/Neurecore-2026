/**
 * Creatio-style component primitives — Phase 2.
 *
 * Re-exports the 6 primitives for clean imports:
 *   import { KpiCard, EntityTable, DetailPanel, ActionButton, StatusBadge, QuickAction } from '@/components/creatio';
 */

export { KpiCard } from './KpiCard';
export type { KpiCardProps } from './KpiCard';

export { EntityTable } from './EntityTable';
export type { ColumnDef } from './EntityTable';

export { DetailPanel } from './DetailPanel';
export type { DetailPanelProps, DetailPanelTab } from './DetailPanel';

export { ActionButton, ActionToolbar } from './ActionToolbar';
export type { ActionVariant, ActionSize, ActionButtonProps, ActionToolbarProps } from './ActionToolbar';

export { StatusBadge, StatusPill } from './StatusBadge';
export type { StatusBadgeProps, BadgeVariant } from './StatusBadge';

export { QuickAction } from './QuickAction';
export type { QuickActionProps } from './QuickAction';

export { Modal } from './Modal';
export type { ModalProps } from './Modal';

export {
  TextField,
  TextAreaField,
  SelectField,
  DateField,
} from './FormField';
export type {
  TextFieldProps,
  TextAreaFieldProps,
  SelectFieldProps,
  DateFieldProps,
} from './FormField';