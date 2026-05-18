"use client";

import {
  FROM_OPTIONS,
  INTERNSHIP_LENGTHS,
  TO_OPTIONS,
} from "@/constants/student-options";
import {
  datesForLength,
  detectLength,
  durationHint,
} from "@/utils/availability";

type Props = {
  hasInternships: boolean;
  availFrom: string;
  availTo: string;
  internshipLength: string;
  onAvailFromChange: (v: string) => void;
  onAvailToChange: (v: string) => void;
  onInternshipLengthChange: (v: string) => void;
};

export function AvailabilityField({
  hasInternships,
  availFrom,
  availTo,
  internshipLength,
  onAvailFromChange,
  onAvailToChange,
  onInternshipLengthChange,
}: Props) {
  const hint = durationHint(availFrom, availTo);

  function handleFromChange(next: string) {
    onAvailFromChange(next);
    if (internshipLength && internshipLength !== "Flexible") {
      const d = datesForLength(internshipLength, next);
      if (d) onAvailToChange(d.to);
    } else {
      onInternshipLengthChange(detectLength(next, availTo));
    }
  }

  function handleToChange(next: string) {
    onAvailToChange(next);
    onInternshipLengthChange(detectLength(availFrom, next));
  }

  function handleLengthChange(len: string) {
    if (internshipLength === len) {
      onInternshipLengthChange("");
      return;
    }
    onInternshipLengthChange(len);
    const d = datesForLength(len, availFrom);
    if (d) {
      onAvailFromChange(d.from);
      onAvailToChange(d.to);
    }
  }

  return (
    <div className="mt-3.5 flex animate-subIn flex-col gap-3.5 rounded-md border border-line bg-[#f5f3ea] p-3.5">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2.5">
          <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
            When are you free?
          </div>
          {hint && (
            <div className="rounded-full border border-line-2 bg-white px-2 py-0.5 font-mono text-[11px] tracking-[0.04em] text-fg">
              {hint}
            </div>
          )}
        </div>
        <div className="flex items-end gap-2.5 max-[520px]:flex-col max-[520px]:items-stretch">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.04em] text-muted">
              From
            </span>
            <select
              className="select-caret w-full rounded-md border border-line-2 px-3 py-2.25 text-[13.5px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring"
              value={availFrom}
              onChange={(e) => handleFromChange(e.target.value)}
            >
              {FROM_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <span className="self-end pb-3 text-sm text-muted-2 max-[520px]:rotate-90 max-[520px]:self-center max-[520px]:pb-0">
            →
          </span>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-mono text-[11px] tracking-[0.04em] text-muted">
              To
            </span>
            <select
              className="select-caret w-full rounded-md border border-line-2 px-3 py-2.25 text-[13.5px] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring"
              value={availTo}
              onChange={(e) => handleToChange(e.target.value)}
            >
              {TO_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {hasInternships && (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2.5">
            <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
              Internship length
            </div>
            <div className="font-mono text-[11px] tracking-[0.02em] lowercase text-muted-2">
              sets your dates
            </div>
          </div>
          <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-line bg-[#f0eee5] p-[3px]">
            {INTERNSHIP_LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => handleLengthChange(len)}
                className={`rounded-md px-2.75 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                  internshipLength === len
                    ? "bg-fg text-white shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {len}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
