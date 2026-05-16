import { OPEN_TO_OPTIONS } from "@/constants/student-options";
import type { Availability, ContactType } from "@/types/student";

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function statusLabel(id: string): string {
  const o = OPEN_TO_OPTIONS.find((opt) => opt.id === id);
  return o ? o.label : id;
}

export function formatAvailability(av: Availability | null): string | null {
  if (!av) return null;
  const from = av.from || "Now";
  const to = av.to || "Ongoing";
  if (from === "Now" && (to === "Ongoing" || !to)) return "Available now";
  if (from === "Now") return `Now – ${to}`;
  if (to === "Ongoing" || !to) return `${from} onwards`;
  const [fM, fY] = from.split(" ");
  const [tM, tY] = to.split(" ");
  if (fY && tY && fY === tY) return `${fM} – ${tM} ${tY}`;
  return `${from} – ${to}`;
}

export function formatContact(type: ContactType, value: string): string {
  if (!value) return "";
  if (type === "linkedin") {
    if (value.startsWith("http")) return value;
    if (value.includes("linkedin.com")) return "https://" + value;
    return "https://linkedin.com/in/" + value.replace(/^@/, "");
  }
  if (type === "email") return "mailto:" + value;
  if (type === "portfolio") {
    if (value.startsWith("http")) return value;
    return "https://" + value;
  }
  return value;
}

export function contactLabel(type: ContactType): string {
  if (type === "linkedin") return "Message on LinkedIn";
  if (type === "email") return "Send an email";
  return "Visit portfolio";
}

export function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${Date.now().toString(36).slice(-3)}`;
}
