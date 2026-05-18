// Shape contract with the NestJS backend. Every route returns this envelope;
// validation errors put per-field detail in `error.details`.

export type ApiValidationDetail = {
  field: string;
  errors: string[];
};

export type ApiErrorPayload = {
  code?: string;
  message?: string;
  details?: ApiValidationDetail[];
};

export type ApiEnvelope<T, M = unknown> = {
  success: boolean;
  data?: T;
  meta?: M;
  error?: ApiErrorPayload;
};

// Returned by http.getPaginated — surfaces the `meta` field alongside `data`,
// which the default unwrap drops.
export type Paginated<T, M> = {
  data: T;
  meta: M;
};

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  multipart?: FormData;
  signal?: AbortSignal;
  // Override per-call. Default is set in fetcher.ts (DEFAULT_TIMEOUT_MS).
  timeoutMs?: number;
  // Don't fire the auth-expired hook on 401 — caller handles refresh.
  skipAuthRedirect?: boolean;
  // Skip GET deduplication for this call.
  skipDedup?: boolean;
  // Skip retry-with-backoff (use for non-idempotent mutations).
  skipRetry?: boolean;
};

// Resolves the current bearer token, or null if the user is anonymous.
// Different on browser (Supabase session) vs server (cookies).
export type TokenProvider = () => Promise<string | null>;

// Called when a 401 cannot be recovered by a session refresh. Browser →
// sign-out + redirect. Server → ignored.
export type AuthExpiredHandler = () => Promise<void> | void;

// Called when a 401 lands and we haven't tried to refresh yet for this
// request. Returns true if the session was refreshed (caller should retry),
// false otherwise (caller should give up and fire AuthExpiredHandler).
export type SessionRefreshHandler = () => Promise<boolean>;
