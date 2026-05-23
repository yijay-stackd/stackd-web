// Bridges the form's display tokens ("Jun 2026", "Now", "Ongoing") with the
// backend's ISO date strings ("2026-06-01"). Backend uses class-validator's
// @IsDateString which accepts any ISO 8601 date — we always emit the first
// of the month so a round-trip through the API doesn't drift a label.

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

// Converts a form token to an ISO date for transport.
// Returns null for tokens that the backend interprets as "no bound" — the
// caller should omit the field entirely rather than send `null`.
export function displayToIso(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token === "Ongoing") return null;
  if (token === "Now") {
    const now = new Date();
    return formatIso(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
  }
  const [mTok, yTok] = token.split(" ");
  const mIdx = MONTHS_SHORT.indexOf(mTok);
  const y = parseInt(yTok, 10);
  if (mIdx < 0 || Number.isNaN(y)) return null;
  return formatIso(y, mIdx + 1, 1);
}

// Reverses displayToIso. Rounds any received date down to its month label
// so dropdowns ("Jun 2026") line up with backend rows even if a future
// migration stores mid-month dates.
export function isoToDisplay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
