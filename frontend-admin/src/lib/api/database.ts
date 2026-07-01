/**
 * Database/Service Utilities
 * Single Responsibility: Handle external API calls to backend
 * Following Interface Segregation - minimal contracts
 *
 * This abstraction allows gradual migration from external NestJS backend
 * to embedded Next.js API routes
 */

import type { NextRequest } from "next/server";

// Base URL for API - use NEXT_PUBLIC_API_URL for browser-accessible API
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://brain.neurecore.com/api/v1"
    : "http://localhost:3000/api/v1");

/**
 * Interface for API request options
 */
export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}

/**
 * Make authenticated API request to backend
 * Single Responsibility: Handle HTTP communication with backend
 */
export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {}, requiresAuth = true } = options;

  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  // Make request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, fetchOptions);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get authentication token from request
 * Used for making authenticated API calls
 */
export async function getAuthToken(
  request: NextRequest,
): Promise<string | null> {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    // Parse auth-token from cookies
    const match = cookieHeader.match(/auth-token=([^;]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Extract user from request for API calls
 */
export async function getCurrentUser(request: NextRequest) {
  const token = await getAuthToken(request);
  if (!token) return null;

  try {
    const response = await apiRequest<{ user: unknown }>("/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.user;
  } catch {
    return null;
  }
}

/**
 * Database entity names for direct Prisma access
 * (Used when backend logic is embedded)
 */
export const DbModels = {
  USER: "user",
  TENANT: "tenant",
  AGENT: "agent",
  AGENT_TEMPLATE: "agentTemplate",
  DEPARTMENT: "department",
  DEPARTMENT_TEMPLATE: "departmentTemplate",
  SESSION: "session",
  AUDIT_LOG: "auditLog",
  NOTIFICATION: "notification",
  CONNECTOR: "connector",
  INVOICE: "invoice",
  EXPENSE: "expense",
  APPROVAL: "approval",
  MEMORY: "memory",
} as const;

export type DbModel = (typeof DbModels)[keyof typeof DbModels];
