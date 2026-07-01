/**
 * API Library Index
 * Single Responsibility: Export all API utilities
 * Following Interface Segregation - organized exports
 */

// Types
export * from './types';

// Response utilities
export {
  successResponse,
  errorResponse,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  serverError,
  conflict,
  noContent,
  paginatedResponse,
} from './response';

// Auth utilities
export {
  verifyToken,
  extractToken,
  decodeToken,
  authenticate,
  hasRole,
  belongsToTenant,
  getRequestMeta,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
} from './auth';

// Database/API utilities
export {
  apiRequest,
  getAuthToken,
  getCurrentUser,
  DbModels,
} from './database';
export type { ApiRequestOptions } from './database';