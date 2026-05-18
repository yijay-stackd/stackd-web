import Link from "next/link";

type Props = {
  query?: string;
  activeTag?: string | null;
  onClearFilters?: () => void;
};

export function FeedEmpty({ query, activeTag, onClearFilters }: Props) {
  const filtered = Boolean(query || activeTag);

  if (filtered) {
    return (
      <div className="flex flex-col items-center py-15 text-center">
        <div className="mx-auto mb-6 grid h-22 w-22 place-items-center rounded-lg bg-[#f0eee2] text-muted">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="14" cy="14" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M21 21L27 27"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="mb-2 text-balance text-[22px] font-semibold tracking-[-0.02em]">
          No matches for{" "}
          {query ? (
            <span className="rounded bg-accent px-2 py-px font-semibold text-accent-fg">
              &lsquo;{query}&rsquo;
            </span>
          ) : activeTag ? (
            <span className="rounded bg-accent px-2 py-px font-semibold text-accent-fg">
              {activeTag}
            </span>
          ) : null}
          .
        </h3>
        <p className="mb-6 max-w-100 text-pretty text-muted">
          Try a different search — or clear filters.
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line-2 bg-transparent px-4 py-2.25 text-sm font-medium text-fg transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-white active:translate-y-0"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-20 text-center">
      <div className="mx-auto mb-6 grid h-22 w-22 animate-pop place-items-center rounded-lg bg-accent text-accent-fg">
        <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 6V26M6 16H26"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-balance text-[22px] font-semibold tracking-[-0.02em]">
        No students yet — be the first to join.
      </h3>
      <p className="mb-6 max-w-100 text-pretty text-muted">
        One page. One form. Goes live the moment you hit submit.
      </p>
      <Link
        href="/join"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0"
      >
        Create your profile
      </Link>
    </div>
  );
}
