/**
 * Auth API Route - Login
 * POST /api/v1/auth/login
 *
 * Following Single Responsibility - handles user login
 * Following Interface Segregation - minimal request/response contracts
 */

import { NextRequest } from "next/server";
import {
  successResponse,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/api/response";
import { apiRequest } from "@/lib/api/database";
import type { LoginInput, AuthResult } from "@/lib/api/types";

/**
 * Handle POST request for user login
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse and validate request body
    const body = await request.json();

    // Validate required fields
    const { email, password } = body;

    if (!email || !password) {
      return badRequest("Missing required fields: email, password");
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest("Invalid email format");
    }

    // Prepare login input
    const loginInput: LoginInput = {
      email,
      password,
    };

    // Call backend API (base URL already includes /api/v1)
    const result = await apiRequest<AuthResult>("/auth/login", {
      method: "POST",
      body: loginInput,
      requiresAuth: false,
    });

    // Set auth token cookie (for server-side sessions)
    const response = successResponse(result);

    // Set HTTP-only cookie for authentication
    response.cookies.set("auth-token", result.tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: result.tokens.expiresIn,
      path: "/",
    });

    // Set refresh token cookie
    response.cookies.set("refresh-token", result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);

    if (error instanceof Error) {
      if (error.message.includes("Invalid credentials")) {
        return unauthorized("Invalid email or password");
      }
    }

    return serverError("Login failed");
  }
}
