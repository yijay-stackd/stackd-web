"use client";

import { useMemo, useState } from "react";
import { useFeed } from "./use-feed";
import { toStudent } from "@/lib/api/profile-mapper";
import { FeedToolbar } from "./feed-toolbar";
import { TagChips } from "./tag-chips";
import { StudentRow } from "./student-row";
import { FeedEmpty } from "./feed-empty";
import { FeedSkeleton } from "./feed-skeleton";
import { FeedError } from "./feed-error";

const POPULAR_TAG_LIMIT = 6;

type DemoState = "auto" | "loading" | "error" | "empty";

type Props = {
  demoState?: DemoState;
};

export function Feed({ demoState = "auto" }: Props) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Server query — full-text + tag filters round-trip to backend.
  // Client-side .filter() below is layered on top for the search-as-you-type
  // experience; for production, push `query` into the feed call instead.
  const feed = useFeed({
    q: query.trim() || undefined,
    skill_slugs: activeTag ? [activeTag] : undefined,
  });

  const profiles = useMemo(
    () => feed.data?.pages.flatMap((p) => p.data) ?? [],
    [feed.data]
  );

  // Translate backend ProfileResponse → frontend Student for the row component.
  const students = useMemo(() => profiles.map(toStudent), [profiles]);

  const popularTags = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) =>
      s.tags.forEach((t) => {
        counts[t] = (counts[t] || 0) + 1;
      })
    );
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, POPULAR_TAG_LIMIT)
      .map(([t]) => t);
  }, [students]);

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
    window.scrollTo({ top: 160, behavior: "smooth" });
  }

  function clearFilters() {
    setQuery("");
    setActiveTag(null);
  }

  const hasFilters = Boolean(query.trim() || activeTag);

  const showSkeleton =
    demoState === "loading" || (demoState === "auto" && feed.isLoading);
  const showError =
    demoState === "error" || (demoState === "auto" && feed.isError);
  const isEmpty =
    demoState === "auto" &&
    !feed.isLoading &&
    !feed.isError &&
    students.length === 0;
  const showTrueEmpty = demoState === "empty" || (isEmpty && !hasFilters);
  const showFilterEmpty = isEmpty && hasFilters;
  const showList =
    demoState === "auto" && !feed.isLoading && students.length > 0;

  return (
    <div className="animate-pageIn">
      <section className="mx-auto max-w-220 px-7 pt-14 pb-7 max-[640px]:px-5 max-[640px]:pt-9 max-[640px]:pb-5">
        <h1 className="mb-3 text-balance text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          Build a bio.
          <br />
          Skip the application.
        </h1>
        <p className="m-0 max-w-[540px] text-pretty text-base text-muted">
          One page, live in a minute. Companies find you and reach out directly.
        </p>
      </section>

      <div className="mx-auto max-w-220 px-7 max-[640px]:px-5">
        <FeedToolbar
          query={query}
          onQueryChange={setQuery}
          count={students.length}
        />

        <TagChips
          tags={popularTags}
          activeTag={activeTag}
          onToggle={(t) => setActiveTag((prev) => (prev === t ? null : t))}
        />

        <div className="pb-20">
          {showSkeleton && <FeedSkeleton />}
          {showError && <FeedError onRetry={() => feed.refetch()} />}
          {showTrueEmpty && <FeedEmpty />}
          {showFilterEmpty && (
            <FeedEmpty
              query={query}
              activeTag={activeTag}
              onClearFilters={clearFilters}
            />
          )}
          {showList &&
            students.map((s, i) => (
              <StudentRow
                key={s.slug}
                student={s}
                index={i}
                isNew={false}
                onTagClick={handleTagClick}
              />
            ))}

          {feed.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
                className="rounded-full border border-line-2 bg-white px-5 py-2.5 text-sm font-medium text-fg transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-fg hover:bg-bg-hover disabled:opacity-60"
              >
                {feed.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-between gap-2.5 border-t border-line py-6 pb-9 font-mono text-[11px] tracking-[0.04em] text-muted">
          <span>stackd · spring 2026</span>
          <span>built for students</span>
        </footer>
      </div>
    </div>
  );
}
