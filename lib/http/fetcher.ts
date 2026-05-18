import { env } from "../env";
import { ApiError, NetworkError, isAbortError } from "./errors";
import { apiLog } from "./log";
import type {
  ApiEnvelope,
  AuthExpiredHandler,
  HttpMethod,
  Paginated,
  RequestOptions,
  SessionRefreshHandler,
  TokenProvider,
} from "./types";

type FetcherConfig = {
  baseUrl?: string;
  tokenProvider: TokenProvider;
  // Single-flight session refresh: called on 401 once per request. If it
  // returns true the original request is retried with the new token before
  // we give up.
  onRefreshSession?: SessionRefreshHandler;
  onAuthExpired?: AuthExpiredHandler;
};

const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000,
  JITTER_MS: 200,
  MAX_DELAY_MS: 10_000,
} as const;

// 408/429/5xx are transient; other 4xx means "your request was wrong".
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// Short window covers render bursts (parent + child both mount and fetch),
// expires fast enough that explicit refetches still work.
const DEDUP_WINDOW_MS = 100;

const DEFAULT_TIMEOUT_MS = 30_000;

type PendingRequest = {
  promise: Promise<unknown>;
  timestamp: number;
};

const pendingRequests = new Map<string, PendingRequest>();

export type Http = {
  get: <T>(path: string, opts?: RequestOptions) => Promise<T>;
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) => Promise<T>;
  delete: <T>(path: string, opts?: RequestOptions) => Promise<T>;
  // Exposes the envelope's `meta` alongside `data` — for paginated endpoints.
  getPaginated: <T, M>(
    path: string,
    opts?: RequestOptions
  ) => Promise<Paginated<T, M>>;
  request: <T>(
    method: HttpMethod,
    path: string,
    opts?: RequestOptions
  ) => Promise<T>;
};

export function createHttp(config: FetcherConfig): Http {
  const baseUrl = config.baseUrl ?? env.apiUrl;

  async function request<T>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {}
  ): Promise<T> {
    const full = await requestWithMeta<T, unknown>(method, path, opts);
    return full.data;
  }

  async function requestWithMeta<T, M>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions = {}
  ): Promise<Paginated<T, M>> {
    // GET dedup only — mutations have side effects.
    if (method === "GET" && !opts.skipDedup) {
      const key = buildDedupKey(method, baseUrl, path, opts.params);
      const pending = pendingRequests.get(key);
      if (pending && Date.now() - pending.timestamp < DEDUP_WINDOW_MS) {
        apiLog.dedup(path);
        return pending.promise as Promise<Paginated<T, M>>;
      }
      const promise = executeWithRetry<T, M>(method, path, opts);
      pendingRequests.set(key, { promise, timestamp: Date.now() });
      // Success keeps the entry warm for the dedup window. Errors evict
      // immediately so a retry (after sign-in, network recovery, etc.)
      // doesn't dedupe to the stale failed promise.
      promise.then(
        () => setTimeout(() => pendingRequests.delete(key), DEDUP_WINDOW_MS),
        () => pendingRequests.delete(key)
      );
      return promise;
    }

    return executeWithRetry<T, M>(method, path, opts);
  }

  async function executeWithRetry<T, M>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions
  ): Promise<Paginated<T, M>> {
    const startedAt = Date.now();
    const maxAttempts = opts.skipRetry ? 1 : RETRY_CONFIG.MAX_RETRIES + 1;
    let attempt = 1;
    let didTryRefresh = false;

    while (true) {
      try {
        return await executeOnce<T, M>(method, path, opts);
      } catch (err) {
        if (isAbortError(err)) throw err;

        // 401: try a one-shot session refresh + retry before giving up.
        // The refresh handler is single-flight so a burst of concurrent 401s
        // shares one refresh round-trip.
        if (
          err instanceof ApiError &&
          err.status === 401 &&
          !opts.skipAuthRedirect &&
          !didTryRefresh &&
          config.onRefreshSession
        ) {
          didTryRefresh = true;
          const refreshed = await config.onRefreshSession();
          if (refreshed) {
            // Retry the same logical attempt — don't consume retry budget.
            continue;
          }
        }

        // 401 with no recovery path: kick the user out.
        if (
          err instanceof ApiError &&
          err.status === 401 &&
          !opts.skipAuthRedirect
        ) {
          if (config.onAuthExpired) await config.onAuthExpired();
          apiLog.error(method, path, Date.now() - startedAt, describe(err));
          throw err;
        }

        if (isRetryable(err) && attempt < maxAttempts) {
          const delay = computeBackoff(attempt);
          apiLog.retry(attempt, RETRY_CONFIG.MAX_RETRIES, delay, describe(err));
          await sleep(delay);
          attempt++;
          continue;
        }

        apiLog.error(method, path, Date.now() - startedAt, describe(err));
        throw err;
      }
    }
  }

  async function executeOnce<T, M>(
    method: HttpMethod,
    path: string,
    opts: RequestOptions
  ): Promise<Paginated<T, M>> {
    const url = buildUrl(baseUrl, path, opts.params);
    // Generate a request ID for correlation. Backend may echo it in
    // x-request-id response header; if so we prefer that (lets backend assign
    // a request ID that matches its own logs). Otherwise we keep ours.
    const clientRequestId = generateRequestId();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Request-ID": clientRequestId,
    };
    const startedAt = Date.now();

    const token = await config.tokenProvider();
    if (token) headers.Authorization = `Bearer ${token}`;

    let body: BodyInit | undefined;
    if (opts.multipart) {
      // Don't set Content-Type — browser fills in the multipart boundary.
      body = opts.multipart;
    } else if (
      opts.body !== undefined &&
      method !== "GET" &&
      method !== "DELETE"
    ) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }

    apiLog.request(method, path);

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { signal: combinedSignal, cancel: cancelTimeout } = withTimeout(
      opts.signal,
      timeoutMs
    );

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body,
        signal: combinedSignal,
        // Caching belongs to TanStack Query, not the transport.
        cache: "no-store",
        credentials: "omit",
      });
    } catch (err) {
      // Distinguish caller abort from our timeout firing — both surface as
      // AbortError, but only the latter should be a NetworkError to the caller.
      if (isAbortError(err)) {
        if (opts.signal?.aborted) throw err;
        throw new NetworkError(new Error(`Request timed out after ${timeoutMs}ms`));
      }
      throw new NetworkError(err);
    } finally {
      cancelTimeout();
    }

    // 401 handling lives in executeWithRetry — it can refresh + retry.

    // 204 No Content — nothing to parse.
    if (res.status === 204) {
      apiLog.success(method, path, Date.now() - startedAt, res.status);
      return { data: undefined as T, meta: undefined as M };
    }

    const requestId = res.headers.get("x-request-id") ?? clientRequestId;
    const envelope = (await safeJson(res)) as ApiEnvelope<T, M> | null;

    if (!res.ok || envelope?.success === false) {
      throw new ApiError({
        status: res.status,
        message:
          envelope?.error?.message ||
          `Request failed with status ${res.status}`,
        code: envelope?.error?.code,
        details: envelope?.error?.details,
        requestId,
      });
    }

    apiLog.success(method, path, Date.now() - startedAt, res.status);
    return { data: envelope?.data as T, meta: envelope?.meta as M };
  }

  return {
    request,
    get: <T>(path: string, opts?: RequestOptions) =>
      request<T>("GET", path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>("POST", path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>("PATCH", path, { ...opts, body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>("PUT", path, { ...opts, body }),
    delete: <T>(path: string, opts?: RequestOptions) =>
      request<T>("DELETE", path, opts),
    getPaginated: <T, M>(path: string, opts?: RequestOptions) =>
      requestWithMeta<T, M>("GET", path, opts),
  };
}

function buildUrl(
  baseUrl: string,
  path: string,
  params?: RequestOptions["params"]
): string {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, baseUrl);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function buildDedupKey(
  method: HttpMethod,
  baseUrl: string,
  path: string,
  params?: RequestOptions["params"]
): string {
  return `${method}:${buildUrl(baseUrl, path, params)}`;
}

function isRetryable(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (err instanceof ApiError) return RETRYABLE_STATUS.has(err.status);
  return false;
}

function computeBackoff(attempt: number): number {
  const exponential =
    RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = Math.random() * RETRY_CONFIG.JITTER_MS;
  return Math.min(exponential + jitter, RETRY_CONFIG.MAX_DELAY_MS);
}

function describe(err: unknown): string {
  if (err instanceof ApiError) return `HTTP ${err.status}${err.code ? ` ${err.code}` : ""}`;
  if (err instanceof NetworkError) return "network error";
  if (err instanceof Error) return err.message;
  return "unknown error";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Short, log-friendly request ID. crypto.randomUUID is available in modern
// browsers, Node 19+, Edge runtime — the only environments we target. Fall
// back to Math.random for ancient runtimes so tests don't blow up.
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

// Returns a signal that aborts when either the caller's signal fires OR the
// timeout elapses. `cancel` clears the pending timer once the fetch settles.
function withTimeout(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
