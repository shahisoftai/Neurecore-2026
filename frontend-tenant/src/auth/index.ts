// ─── index.ts ─────────────────────────────────────────────────────────────────

export { AuthProvider } from './components/AuthProvider';
export { AuthLoadingScreen } from './components/AuthLoadingScreen';
export { SessionExpiredScreen } from './components/SessionExpiredScreen';
export { AuthErrorScreen } from './components/AuthErrorScreen';
export { LockoutScreen } from './components/LockoutScreen';

export { useAuth } from './hooks/useAuth';
export { useTenantAuth } from './hooks/useTenantAuth';
export { useRequireAuth } from './hooks/useRequireAuth';

export { authService } from './di/authContainer';
export { AuthError } from './core/interfaces';
export type {
  AuthState,
  AuthFailure,
  AuthEvent,
  IAuthService,
  IAuthSessionLifecycle,
  ITokenRepository,
  IUserRepository,
  IAuthApi,
  IRefreshCoordinator,
  IAuthEventBus,
  IAuthRouteRegistry,
  SessionKilledEvent,
  SessionKillReason,
} from './core/interfaces';
export { useAuthStore } from './impl/ZustandUserRepository';
