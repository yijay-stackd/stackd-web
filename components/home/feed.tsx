"use client";

import { useMemo, useState } from "react";
import { useStudents } from "@/components/providers/students-provider";
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
  const { students, recentSlugs } = useStudents();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((s) => {
      if (
        activeTag &&
        !s.tags.some((t) => t.toLowerCase() === activeTag.toLowerCase())
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        s.name.toLowerCase().includes(needle) ||
        s.university.toLowerCase().includes(needle) ||
        s.course.toLowerCase().includes(needle) ||
        s.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [students, query, activeTag]);

  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
    window.scrollTo({ top: 160, behavior: "smooth" });
  }

  function clearFilters() {
    setQuery("");
    setActiveTag(null);
  }

  const showSkeleton = demoState === "loading";
  const showError = demoState === "error";
  const showTrueEmpty = demoState === "empty" || (demoState === "auto" && students.length === 0);
  const showFilterEmpty =
    demoState === "auto" && students.length > 0 && filtered.length === 0;
  const showList = demoState === "auto" && filtered.length > 0;

  return (
    <div className="animate-pageIn">
      <section className="mx-auto max-w-220 px-7 pt-14 pb-7 max-[640px]:px-5 max-[640px]:pt-9 max-[640px]:pb-5">
        <h1 className="mb-3 text-balance text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.05] tracking-[-0.028em]">
          Students putting themselves
          <br />
          on the map.
        </h1>
        <p className="m-0 max-w-[540px] text-pretty text-base text-muted">
          Browse, find someone interesting, reach out directly. No accounts, no gates.
        </p>
      </section>

      <div className="mx-auto max-w-220 px-7 max-[640px]:px-5">
        <FeedToolbar
          query={query}
          onQueryChange={setQuery}
          count={filtered.length}
        />

        <TagChips
          tags={popularTags}
          activeTag={activeTag}
          onToggle={(t) => setActiveTag((prev) => (prev === t ? null : t))}
        />

        <div className="pb-20">
          {showSkeleton && <FeedSkeleton />}
          {showError && <FeedError onRetry={() => undefined} />}
          {showTrueEmpty && <FeedEmpty />}
          {showFilterEmpty && (
            <FeedEmpty
              query={query}
              activeTag={activeTag}
              onClearFilters={clearFilters}
            />
          )}
          {showList &&
            filtered.map((s, i) => (
              <StudentRow
                key={s.slug}
                student={s}
                index={i}
                isNew={recentSlugs.includes(s.slug)}
                onTagClick={handleTagClick}
              />
            ))}
        </div>

        <footer className="flex flex-wrap justify-between gap-2.5 border-t border-line py-6 pb-9 font-mono text-[11px] tracking-[0.04em] text-muted">
          <span>stackd · spring 2026</span>
          <span>built for students</span>
        </footer>
      </div>
    </div>
  );
}
