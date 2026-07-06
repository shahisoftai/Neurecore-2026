/**
 * Hooks barrel export (Phase 7 + Phase 8)
 *
 * SOLID: Single export point for all custom hooks
 * Maintains clean import paths: import { useFormValidation, useSearch } from '@/hooks'
 */

// Phase 7: Form management
export {
    useFormValidation,
    type ValidationRule,
    type ValidationSchema,
    type UseFormValidationProps,
    type UseFormValidationReturn,
} from './useFormValidation';

// Phase 8: Search & filtering
export {
    useSearch,
    type SearchFilter,
    type SearchState,
    type SearchResult,
    type UseSearchConfig,
    type UseSearchReturn,
} from './useSearch';
