// ─── di/authContainer.ts ──────────────────────────────────────────────────────
// Composition root. The ONLY place that wires concrete classes as interfaces.

import { BaseAuthService } from '../impl/BaseAuthService';
import { AuthSessionLifecycle } from '../impl/AuthSessionLifecycle';
import { CookieTokenRepository } from '../impl/CookieTokenRepository';
import { ZustandUserRepository } from '../impl/ZustandUserRepository';
import { RestAuthApi } from '../impl/RestAuthApi';
import { SingleFlightRefreshCoordinator } from '../impl/SingleFlightRefreshCoordinator';
import { AuthEventBus } from '../impl/AuthEventBus';
import { AuthRouteRegistry } from '../impl/AuthRouteRegistry';
import { authHttpClient } from '../transport/authHttpClient';
import { attachAuthInterceptor } from '../transport/authResponseInterceptor';
import type {
  IAuthService,
  IAuthSessionLifecycle,
  ITokenRepository,
  IUserRepository,
  IAuthApi,
  IRefreshCoordinator,
  IAuthEventBus,
  IAuthRouteRegistry,
} from '../core/interfaces';

// ─── L3 instantiation (each is an interface in the type system only) ──────────
const tokenRepository: ITokenRepository = new CookieTokenRepository();
const userRepository: IUserRepository = new ZustandUserRepository();
const authApi: IAuthApi = new RestAuthApi();
const refreshCoordinator: IRefreshCoordinator = new SingleFlightRefreshCoordinator(authApi, tokenRepository);
const eventBus: IAuthEventBus = new AuthEventBus();
const routeRegistry: IAuthRouteRegistry = new AuthRouteRegistry();

const sessionLifecycle: IAuthSessionLifecycle = new AuthSessionLifecycle(
  tokenRepository,
  userRepository,
  eventBus,
);

// ─── L2: the facade ─────────────────────────────────────────────────────────
export const authService: IAuthService = new BaseAuthService(
  userRepository,
  tokenRepository,
  authApi,
  refreshCoordinator,
  sessionLifecycle,
  eventBus,
  routeRegistry,
);

// ─── Wire the response interceptor → authService.reportAuthFailure ─────────
attachAuthInterceptor(authHttpClient, (failure) => authService.reportAuthFailure(failure));

// Test-only: re-wire helpers.
export const __authContainer = {
  tokenRepository,
  userRepository,
  authApi,
  refreshCoordinator,
  eventBus,
  routeRegistry,
  sessionLifecycle,
};
