export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} ${diffH === 1 ? "hour" : "hours"} ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} ${diffD === 1 ? "day" : "days"} ago`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `${diffMo} ${diffMo === 1 ? "month" : "months"} ago`;
  const diffY = Math.floor(diffMo / 12);
  return `${diffY} ${diffY === 1 ? "year" : "years"} ago`;
}
