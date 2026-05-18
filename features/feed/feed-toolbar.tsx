"use client";

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  count: number;
};

export function FeedToolbar({ query, onQueryChange, count }: Props) {
  return (
    <div className="sticky top-[52px] z-40 flex items-center gap-3 border-y border-line py-3.5 bg-translucent backdrop-blur-[14px]">
      <div className="relative flex-1 min-w-0">
        <svg
          className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-muted-2"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
        >
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M11 11L14 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <input
          className="w-full border-none bg-transparent py-1.5 pl-6 text-sm outline-none placeholder:text-muted-2"
          type="text"
          placeholder="Search name, university, or skill…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        {query && (
          <button
            className="absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-fg"
            onClick={() => onQueryChange("")}
            aria-label="Clear"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3L11 11M11 3L3 11"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      <div className="whitespace-nowrap border-l border-line-2 pl-3.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
        {count} {count === 1 ? "student" : "students"}
      </div>
    </div>
  );
}
