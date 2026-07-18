import { redactForLogging } from "./privacy/redaction";

export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "EXTERNAL_SERVICE_ERROR"
  | "PRIVACY_VIOLATION"
  | "INTERNAL_ERROR";

export interface SafeErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    status: number;
    details?: Record<string, string | number | boolean | null>;
  };
}

export class CivicLensError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, string | number | boolean | null>;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    details?: Record<string, string | number | boolean | null>,
  ) {
    super(message);
    this.name = "CivicLensError";
    this.code = code;
    this.status = status;
    this.details = sanitizeDetails(details);
  }
}

export class ValidationError extends CivicLensError {
  constructor(message: string, details?: Record<string, string | number | boolean | null>) {
    super("BAD_REQUEST", message, 400, details);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends CivicLensError {
  constructor(message: string, details?: Record<string, string | number | boolean | null>) {
    super("NOT_FOUND", message, 404, details);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends CivicLensError {
  constructor(message = "Too many requests.", details?: Record<string, string | number | boolean | null>) {
    super("RATE_LIMITED", message, 429, details);
    this.name = "RateLimitError";
  }
}

export class ExternalServiceError extends CivicLensError {
  constructor(service: string, status?: number) {
    super("EXTERNAL_SERVICE_ERROR", `${service} is unavailable.`, 502, {
      service,
      upstreamStatus: status ?? null,
    });
    this.name = "ExternalServiceError";
  }
}

export class PrivacyError extends CivicLensError {
  constructor(message = "Request cannot be processed without violating privacy rules.") {
    super("PRIVACY_VIOLATION", message, 400);
    this.name = "PrivacyError";
  }
}

export function isCivicLensError(error: unknown): error is CivicLensError {
  return error instanceof CivicLensError;
}

export function toSafeErrorPayload(error: unknown): SafeErrorPayload {
  if (isCivicLensError(error)) {
    return {
      error: {
        code: error.code,
        message: redactForLogging(error.message),
        status: error.status,
        details: error.details,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      status: 500,
    },
  };
}

export function getErrorStatus(error: unknown): number {
  return isCivicLensError(error) ? error.status : 500;
}

function sanitizeDetails(
  details: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!details) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === "string" ? redactForLogging(value) : value,
    ]),
  );
}
