// Backwards-compatible re-export. The auth store is now owned by
// src/auth/impl/ZustandUserRepository.ts. All consumers should prefer:
//   import { useAuthStore } from '@/auth';
// but the old `@/stores/authStore` import path keeps working.
export { useAuthStore } from '@/auth';
