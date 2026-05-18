"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useUniversitySearch } from "@/components/forms/use-university-search";
import { useDebouncedValue } from "@/utils/use-debounced-value";
import type { University } from "@/lib/api/universities";

const DEBOUNCE_MS = 200;
const MIN_QUERY = 1;

type Props = {
  value: string;
  onChange: (next: string) => void;
  // Fires when user picks from the dropdown — needed because backend creates
  // require university_id (UUID), not the free-text name.
  onPick?: (university: University | null) => void;
  hasError?: boolean;
  className?: string;
  placeholder?: string;
};

export function UniversityAutocomplete({
  value,
  onChange,
  onPick,
  hasError,
  className,
  placeholder = "Stanford University",
}: Props) {
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const debouncedQuery = useDebouncedValue(value, DEBOUNCE_MS);
  const { data, isFetching, error, isSuccess } =
    useUniversitySearch(debouncedQuery);
  const results: University[] = data ?? [];

  // Reset highlight on new results — TanStack drives results from outside React.
  useEffect(() => {
    if (!isSuccess) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [isSuccess, results.length]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(row: University) {
    onChange(row.name);
    onPick?.(row);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const errorMessage = error
    ? error instanceof Error
      ? error.message
      : "Couldn't reach search"
    : null;

  const showPanel =
    open &&
    (isFetching ||
      errorMessage ||
      results.length > 0 ||
      value.trim().length >= MIN_QUERY);

  return (
    <div ref={containerRef} className="relative">
      <input
        className={className}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={Boolean(showPanel)}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-invalid={hasError || undefined}
      />

      {showPanel && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border border-line-2 bg-white shadow-lg"
        >
          {isFetching && (
            <li className="px-3.5 py-2 text-[13.5px] text-muted">Searching…</li>
          )}

          {!isFetching && errorMessage && (
            <li className="px-3.5 py-2 text-[13.5px] text-danger">
              {errorMessage}
            </li>
          )}

          {!isFetching && !errorMessage && results.length === 0 && (
            <li className="px-3.5 py-2 text-[13.5px] text-muted">
              No matches — you can type it in.
            </li>
          )}

          {!isFetching &&
            !errorMessage &&
            results.map((r, idx) => (
              <li
                key={r.id}
                role="option"
                aria-selected={idx === activeIndex}
                className={`cursor-pointer px-3.5 py-2 text-[14.5px] ${
                  idx === activeIndex ? "bg-[#f0eee5]" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <div className="font-medium">{r.name}</div>
                {r.country && (
                  <div className="font-mono text-[11px] uppercase tracking-widest text-muted">
                    {r.country}
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
