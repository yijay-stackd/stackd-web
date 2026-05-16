import type { ContactType, OpenToId } from "@/types/student";

export const PHOTO_COLORS = [
  "#FFD9B3",
  "#C8E6FF",
  "#E4D4FF",
  "#FFD4DD",
  "#D4F0C8",
  "#FFE9A8",
  "#D9D4FF",
  "#FFE0CC",
  "#CCEEE6",
  "#F0D9FF",
] as const;

export const YEAR_OPTIONS = [
  "1st",
  "2nd",
  "3rd",
  "4th",
  "Masters",
  "PhD",
] as const;

export const OPEN_TO_OPTIONS: { id: OpenToId; label: string }[] = [
  { id: "internships", label: "Internships" },
  { id: "full-time", label: "Full-time" },
  { id: "part-time", label: "Part-time" },
  { id: "freelance", label: "Freelance" },
  { id: "research", label: "Research" },
];

export const INTERNSHIP_LENGTHS = [
  "1–3 mo",
  "3–6 mo",
  "6+ mo",
  "Summer only",
  "Flexible",
] as const;

export const CONTACT_TYPES: { id: ContactType; label: string }[] = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
  { id: "portfolio", label: "Portfolio" },
];

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

function buildMonths(startYear: number, startMonth: number, count: number): string[] {
  const out: string[] = [];
  let y = startYear;
  let m = startMonth;
  for (let i = 0; i < count; i++) {
    out.push(`${MONTHS_SHORT[m]} ${y}`);
    m++;
    if (m === 12) {
      m = 0;
      y++;
    }
  }
  return out;
}

// Rolling 24-month window from current month
const MONTH_RANGE = buildMonths(2026, 4, 24);
export const FROM_OPTIONS = ["Now", ...MONTH_RANGE];
export const TO_OPTIONS = ["Ongoing", ...MONTH_RANGE];
