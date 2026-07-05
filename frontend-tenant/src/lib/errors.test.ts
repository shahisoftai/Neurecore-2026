import { describe, it, expect } from "vitest";
import {
  AppError,
  ErrorCode,
  parseApiError,
  getUserFriendlyMessage,
} from "./errors";

describe("AppError", () => {
  it("should create an AppError with default values", () => {
    const err = new AppError("test message", ErrorCode.INTERNAL_ERROR);
    expect(err.name).toBe("AppError");
    expect(err.message).toBe("test message");
    expect(err.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  it("should create an AppError with custom statusCode and options", () => {
    const err = new AppError("not found", ErrorCode.NOT_FOUND, 404, {
      details: { resourceId: "abc" },
      requestId: "req-123",
    });
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ resourceId: "abc" });
    expect(err.requestId).toBe("req-123");
  });

  it("should return user-friendly message via getUserFriendlyMessage", () => {
    const err = new AppError("raw", ErrorCode.PERMISSION_DENIED);
    expect(err.getUserFriendlyMessage()).toContain(
      "don't have permission",
    );
  });

  it("should fall back to raw message if code has no friendly mapping", () => {
    const err = new AppError("custom raw message", "UNKNOWN_CODE", 400);
    expect(err.getUserFriendlyMessage()).toBe("custom raw message");
  });
});

describe("getUserFriendlyMessage", () => {
  it("should return mapped message for known error codes", () => {
    const err = new AppError("", ErrorCode.TOKEN_EXPIRED);
    const msg = getUserFriendlyMessage(err);
    expect(msg).toContain("session has expired");
  });

  it("should return a mapped message for plain errors via parseApiError", () => {
    const err = new Error("network down");
    const msg = getUserFriendlyMessage(err);
    expect(msg).toBe("Something went wrong. Please try again later.");
  });

  it("should return a fallback for non-Error values", () => {
    const msg = getUserFriendlyMessage("raw string");
    expect(msg).toBe("Something went wrong. Please try again later.");
  });
});

describe("parseApiError", () => {
  it("should parse an axios-style error response", () => {
    const axiosErr = {
      response: {
        status: 401,
        data: {
          status: "error",
          error: {
            code: ErrorCode.CREDENTIALS_INVALID,
            message: "Invalid email or password",
          },
          meta: {
            timestamp: "2026-01-01T00:00:00Z",
            requestId: "req-abc",
          },
        },
      },
    };

    const result = parseApiError(axiosErr);
    expect(result).toBeInstanceOf(AppError);
    expect(result.code).toBe(ErrorCode.CREDENTIALS_INVALID);
    expect(result.statusCode).toBe(401);
    expect(result.requestId).toBe("req-abc");
  });

  it("should pass through an existing AppError", () => {
    const original = new AppError("original", ErrorCode.RATE_LIMIT_EXCEEDED, 429);
    const result = parseApiError(original);
    expect(result).toBe(original);
  });

  it("should wrap a plain Error into an AppError", () => {
    const plain = new Error("network down");
    const result = parseApiError(plain);
    expect(result).toBeInstanceOf(AppError);
    expect(result.message).toContain("network down");
  });
});
