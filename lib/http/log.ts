// Colored debug logger for API calls, dev-only. Mirrors the pattern from
// hata's services/api.ts so the network panel narrative is easy to follow in
// the console.

const DEBUG =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_API_DEBUG === "true");

const COLORS = {
  request: "color: #8B5CF6",
  muted: "color: #6B7280",
  success: "color: #10B981",
  error: "color: #EF4444",
  retry: "color: #F59E0B",
  dedup: "color: #06B6D4",
} as const;

export const apiLog = {
  request(method: string, endpoint: string) {
    if (!DEBUG) return;
    console.log(`%c[API] ${method} ${endpoint}`, COLORS.request);
  },
  success(method: string, endpoint: string, duration: number, status: number) {
    if (!DEBUG) return;
    console.log(
      `%c[API] ${method} ${endpoint} %c(${duration}ms) %c✓ ${status}`,
      COLORS.request,
      COLORS.muted,
      COLORS.success
    );
  },
  error(
    method: string,
    endpoint: string,
    duration: number,
    status: number | string
  ) {
    if (!DEBUG) return;
    console.log(
      `%c[API] ${method} ${endpoint} %c(${duration}ms) %c✗ ${status}`,
      COLORS.request,
      COLORS.muted,
      COLORS.error
    );
  },
  retry(attempt: number, max: number, delay: number, reason: string) {
    if (!DEBUG) return;
    console.log(
      `%c[API] Retry ${attempt}/${max} in ${delay}ms — ${reason}`,
      COLORS.retry
    );
  },
  dedup(endpoint: string) {
    if (!DEBUG) return;
    console.log(`%c[API] Deduplicated ${endpoint}`, COLORS.dedup);
  },
};
