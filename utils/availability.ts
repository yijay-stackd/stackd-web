// Helpers to sync internship length chip ↔ from/to month dropdowns.
// "Now" is treated as the project's notional current month (May 2026).
// "Ongoing" is the open-ended To sentinel.

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const NOW: MonthDate = { m: 4, y: 2026 };

export type MonthDate = { m: number; y: number };

export function parseMonth(token: string | null | undefined): MonthDate | null {
  if (!token || token === "Ongoing") return null;
  if (token === "Now") return NOW;
  const [mTok, yTok] = token.split(" ");
  const idx = MONTHS_SHORT.indexOf(mTok);
  if (idx < 0) return null;
  return { m: idx, y: parseInt(yTok, 10) };
}

export function addMonths(d: MonthDate, n: number): MonthDate {
  const total = d.y * 12 + d.m + n;
  return { m: ((total % 12) + 12) % 12, y: Math.floor(total / 12) };
}

export function formatMonth(d: MonthDate): string {
  return `${MONTHS_SHORT[d.m]} ${d.y}`;
}

export function monthsBetween(a: MonthDate, b: MonthDate): number {
  return b.y * 12 + b.m - (a.y * 12 + a.m);
}

export function detectLength(from: string, to: string): string {
  if (!from) return "";
  if (to === "Ongoing") return "6+ mo";
  const f = parseMonth(from);
  const t = parseMonth(to);
  if (!f || !t) return "";
  const months = monthsBetween(f, t);
  if (months < 1) return "";
  if (f.m >= 5 && f.m <= 7 && months <= 3 && f.y === t.y && t.m <= 8) {
    return "Summer only";
  }
  if (months <= 3) return "1–3 mo";
  if (months <= 6) return "3–6 mo";
  return "6+ mo";
}

export function datesForLength(
  len: string,
  currentFrom: string
): { from: string; to: string } | null {
  const fRaw = currentFrom || "Now";
  const f = parseMonth(fRaw) || NOW;
  if (len === "1–3 mo") return { from: fRaw, to: formatMonth(addMonths(f, 3)) };
  if (len === "3–6 mo") return { from: fRaw, to: formatMonth(addMonths(f, 6)) };
  if (len === "6+ mo") return { from: fRaw, to: "Ongoing" };
  if (len === "Summer only") {
    let year = f.y;
    if (f.m > 5) year++;
    return { from: `Jun ${year}`, to: `Aug ${year}` };
  }
  return null;
}

export function durationHint(from: string, to: string): string | null {
  if (!from) return null;
  if (to === "Ongoing") return "ongoing";
  const f = parseMonth(from);
  const t = parseMonth(to);
  if (!f || !t) return null;
  const months = monthsBetween(f, t);
  if (months < 0) return "invalid range";
  if (months === 0) return "same month";
  if (months === 1) return "≈ 1 month";
  if (months < 12) return `≈ ${months} months`;
  if (months === 12) return "≈ 1 year";
  return `≈ ${(months / 12).toFixed(1)} years`;
}
