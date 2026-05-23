"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ICity, ICountry } from "country-state-city";

type Props = {
  city: string | null;
  countryCode: string | null;
  onChange: (next: { city: string | null; countryCode: string | null }) => void;
  inputClass: string;
};

// LinkedIn-style single combobox: type "London" → suggestions show
// "London, United Kingdom" / "London, Canada" so the user disambiguates
// inline rather than picking country up front. Only a suggestion that came
// from the dataset commits city + country_code together — free-typed text
// clears both fields, so we never store an orphan city.

// Pre-built per-load search index. Flat array so a single linear scan with
// early-exit covers the whole world. ~150k entries; the linear scan is fine
// in practice because we cap result count and we only filter on user input.
type CityEntry = {
  name: string;
  countryCode: string;
  countryName: string;
  // Pre-lowercased to skip per-keystroke .toLowerCase() over 150k strings.
  nameLower: string;
};

// The `country-state-city` package ships ~5–10 MB of city JSON. Lazy-import
// it so the join page's initial bundle stays slim — students who skip the
// (optional) location field never pay the download cost.
type CountryStateCity = typeof import("country-state-city");
let csccPromise: Promise<CountryStateCity> | null = null;
function loadCsc(): Promise<CountryStateCity> {
  if (!csccPromise) csccPromise = import("country-state-city");
  return csccPromise;
}

type LocationIndex = {
  cities: CityEntry[];
  countryNameByCode: Map<string, string>;
};

// Build once per page load — module-level cache so the second focus is free.
// On rejection we clear the cache so the next focus retries instead of
// reusing a permanently-failed promise.
let indexPromise: Promise<LocationIndex> | null = null;
function loadIndex(): Promise<LocationIndex> {
  if (indexPromise) return indexPromise;
  const p = loadCsc().then((m) => {
    const countries = m.Country.getAllCountries();
    const countryNameByCode = new Map<string, string>(
      countries.map((c: ICountry) => [c.isoCode, c.name])
    );
    const all = m.City.getAllCities();
    // Dedupe by (name, countryCode) — same city listed under multiple
    // states would otherwise produce four "London, United Kingdom" rows.
    const seen = new Set<string>();
    const cities: CityEntry[] = [];
    for (const c of all as ICity[]) {
      const key = `${c.name}|${c.countryCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cities.push({
        name: c.name,
        countryCode: c.countryCode,
        countryName: countryNameByCode.get(c.countryCode) ?? c.countryCode,
        nameLower: c.name.toLowerCase(),
      });
    }
    return { cities, countryNameByCode };
  });
  indexPromise = p;
  p.catch(() => {
    if (indexPromise === p) indexPromise = null;
  });
  return p;
}

const MAX_RESULTS = 30;

export function LocationPicker({ city, countryCode, onChange, inputClass }: Props) {
  const [index, setIndex] = useState<LocationIndex | null>(null);
  const [loading, setLoading] = useState(false);
  // `editingQuery !== null` means the user is actively typing — we trust
  // local state. Otherwise we derive the displayed value from props, so the
  // label always reflects whatever the parent has committed (including
  // post-load country-name upgrades for "GB" → "United Kingdom").
  const [editingQuery, setEditingQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Guards setState calls that resolve after the component unmounts —
  // benign in React 18 but spams dev warnings.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const committedLabel = formatCommittedLabel(city, countryCode, index);
  const hasCommit = Boolean(city && countryCode);
  const displayValue = editingQuery !== null ? editingQuery : committedLabel;

  function ensureIndex() {
    if (index || loading) return;
    setLoading(true);
    loadIndex()
      .then((entries) => {
        if (!mountedRef.current) return;
        setIndex(entries);
        setLoading(false);
      })
      .catch(() => {
        // Surface load failure by ending the loading spinner. The combobox
        // will then show "No cities match…" for any query — the user can
        // refocus to retry (loadIndex clears its cached rejection).
        if (!mountedRef.current) return;
        setLoading(false);
      });
  }

  const matches = useMemo(() => {
    if (!index) return [];
    const q = displayValue.trim().toLowerCase();
    if (!q) return [];
    // Two-pass scan: prefer prefix matches over substring matches so
    // "lon" surfaces "London, …" before "Loncon" or "Pelonia". Same cap
    // applies across both passes combined.
    const starts: CityEntry[] = [];
    const contains: CityEntry[] = [];
    for (const c of index.cities) {
      if (c.nameLower.startsWith(q)) starts.push(c);
      else if (c.nameLower.includes(q)) contains.push(c);
      if (starts.length >= MAX_RESULTS) break;
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [index, displayValue]);

  function commit(entry: CityEntry) {
    // Clearing editing state hands display back to the derived committed
    // label, which will format as "City, FullCountryName" from props+index.
    setEditingQuery(null);
    setOpen(false);
    onChange({ city: entry.name, countryCode: entry.countryCode });
  }

  function handleKey(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (ev.key === "Enter") {
      if (open && matches[highlight]) {
        ev.preventDefault();
        commit(matches[highlight]);
      }
    } else if (ev.key === "Escape") {
      setOpen(false);
      setEditingQuery(null);
    }
  }

  const placeholder = loading ? "Loading cities…" : "Search city, e.g. London";

  return (
    <div className="relative">
      <input
        className={`${inputClass} border-line-2`}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        onFocus={() => {
          ensureIndex();
          // Enter editing mode with an empty buffer so the user can type
          // freely instead of fighting to delete the "City, Country" label.
          if (hasCommit) setEditingQuery("");
          else setEditingQuery(displayValue);
          setOpen(true);
        }}
        onChange={(e) => {
          setEditingQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
          // Typing invalidates the previous structured pick — clear it so
          // we never submit a city the user didn't confirm from the list.
          if (hasCommit) onChange({ city: null, countryCode: null });
        }}
        onKeyDown={handleKey}
        onBlur={() => {
          // Covers Tab-away and outside clicks. The listbox uses
          // onMouseDown preventDefault so clicks inside the dropdown
          // (gaps and individual options) don't blur the input.
          setOpen(false);
          setEditingQuery(null);
        }}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="location-picker-listbox"
        aria-expanded={open}
      />
      {open && (
        <ul
          id="location-picker-listbox"
          role="listbox"
          // preventDefault on mousedown keeps focus on the input so clicking
          // in gaps between options (or on the listbox scrollbar) doesn't
          // blur the field and collapse the dropdown mid-pick.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-md border border-line-2 bg-white shadow-md"
        >
          {loading && (
            <li className="px-3.5 py-2 text-[13.5px] text-muted">Loading…</li>
          )}
          {!loading && displayValue.trim() && matches.length === 0 && (
            <li className="px-3.5 py-2 text-[13.5px] text-muted">
              No cities match &quot;{displayValue.trim()}&quot;.
            </li>
          )}
          {!loading && !displayValue.trim() && (
            <li className="px-3.5 py-2 text-[13.5px] text-muted">
              Start typing to search…
            </li>
          )}
          {matches.map((c, i) => (
            <li
              key={`${c.name}-${c.countryCode}-${i}`}
              role="option"
              aria-selected={i === highlight}
              className={`cursor-pointer px-3.5 py-2 text-[14px] ${
                i === highlight ? "bg-[#f0eee5] text-fg" : "text-fg"
              }`}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(c);
              }}
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-muted">, {c.countryName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatCommittedLabel(
  city: string | null,
  countryCode: string | null,
  index: LocationIndex | null
): string {
  if (!city) return "";
  if (!countryCode) return city;
  // Prefer full country name once the dataset is loaded — fall back to the
  // ISO-2 code so the input never renders blank during the initial fetch.
  const fullName = index?.countryNameByCode.get(countryCode);
  return `${city}, ${fullName ?? countryCode}`;
}
