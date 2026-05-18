import type { ApiValidationDetail } from "./types";

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: ApiValidationDetail[];
  readonly requestId?: string;

  constructor(args: {
    status: number;
    message: string;
    code?: string;
    details?: ApiValidationDetail[];
    requestId?: string;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
    this.requestId = args.requestId;
  }

  // Convenience: map backend validation details to a { field: firstError } map
  // for form rendering. Returns null when there's nothing to render inline.
  fieldErrors(): Record<string, string> | null {
    if (!this.details || this.details.length === 0) return null;
    const out: Record<string, string> = {};
    for (const d of this.details) {
      if (d.errors[0]) out[d.field] = d.errors[0];
    }
    return Object.keys(out).length > 0 ? out : null;
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Network error");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    err instanceof DOMException && err.name === "AbortError"
  ) || (err instanceof Error && err.name === "AbortError");
}
