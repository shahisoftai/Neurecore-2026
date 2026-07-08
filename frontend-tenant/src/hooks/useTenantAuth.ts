// Backwards-compatible re-export.
// The real implementation is now in src/auth/hooks/useTenantAuth.ts and is a
// discriminated-state wrapper over useAuth(). This file exists so the old
// `@/hooks/useTenantAuth` import path keeps working.
export { useTenantAuth } from '@/auth/hooks/useTenantAuth';
