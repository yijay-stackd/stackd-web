"use client";

type Props = {
  tags: string[];
  activeTag: string | null;
  onToggle: (tag: string) => void;
};

export function TagChips({ tags, activeTag, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-3.5 pb-1">
      {tags.map((t) => {
        const active = activeTag === t;
        return (
          <button
            key={t}
            onClick={() => onToggle(t)}
            className={
              active
                ? "inline-flex items-center gap-1 font-mono text-[11px] font-medium tracking-[0.02em] whitespace-nowrap rounded-full border px-3 py-1 bg-fg text-white border-fg transition-colors duration-150"
                : "inline-flex items-center font-mono text-[11px] font-medium tracking-[0.02em] whitespace-nowrap rounded-full border px-3 py-1 bg-transparent text-muted border-line-2 hover:border-fg hover:text-fg transition-colors duration-150"
            }
          >
            {t}
            {active && <span className="opacity-60 text-[10px]">×</span>}
          </button>
        );
      })}
    </div>
  );
}
