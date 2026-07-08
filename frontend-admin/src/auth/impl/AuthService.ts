// ─── impl/AuthService.ts (admin variant) ──────────────────────────────────────
// L2 facade for the admin portal. Same state machine as tenant, but
// loginWithGoogle() and register() are unavailable — those endpoints are
// tenant-portal-only on the backend.

import { AuthError } from '../core/interfaces';
import type { LoginPayload, RegisterPayload } from '../core/interfaces';
import { BaseAuthService } from './BaseAuthService';
import type {
  IUserRepository,
  ITokenRepository,
  IAuthApi,
  IAuthSessionLifecycle,
  IRefreshCoordinator,
  IAuthEventBus,
  IAuthRouteRegistry,
} from '../core/interfaces';

export class AuthService extends BaseAuthService {
  constructor(
    userRepository: IUserRepository,
    tokenRepository: ITokenRepository,
    authApi: IAuthApi,
    refreshCoordinator: IRefreshCoordinator,
    sessionLifecycle: IAuthSessionLifecycle,
    eventBus: IAuthEventBus,
    routeRegistry: IAuthRouteRegistry,
  ) {
    super(userRepository, tokenRepository, authApi, refreshCoordinator, sessionLifecycle, eventBus, routeRegistry);
  }

  // Disable registration in the admin portal (operator accounts are seeded server-side).
  override async register(_input: RegisterPayload): Promise<void> {
    throw new AuthError('unknown', 'Registration is not available in the admin portal.');
  }

  // Google login is a tenant-portal feature.
  override async loginWithGoogle(_idToken: string, _intent: 'signin' | 'link'): Promise<void> {
    throw new AuthError('unknown', 'Google sign-in is not available in the admin portal.');
  }

  // Override login to also enforce admin-role allow-list locally.
  override async login(payload: LoginPayload): Promise<void> {
    await super.login(payload);
    const user = this.getUser();
    if (!user) return;
    const ADMIN_ROLES = ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'SECURITY_OFFICER', 'SUPPORT'];
    if (!ADMIN_ROLES.includes(user.role)) {
      await super.logout();
      throw new AuthError('unknown', 'Insufficient permissions for admin portal.');
    }
  }
}
