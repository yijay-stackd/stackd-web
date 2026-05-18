"use client";

import { useState } from "react";

type Props = {
  tags: string[];
  onChange: (next: string[]) => void;
  max?: number;
};

export function TagInput({ tags, onChange, max = 6 }: Props) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim().replace(/,$/, "");
    if (!v) return;
    if (tags.includes(v)) {
      setDraft("");
      return;
    }
    if (tags.length >= max) return;
    onChange([...tags, v]);
    setDraft("");
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Backspace" && !draft && tags.length) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex min-h-11 flex-wrap gap-1.5 rounded-md border border-line-2 bg-white p-2 transition-[border-color,box-shadow] duration-150 focus-within:border-fg focus-within:shadow-focus-ring">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1.5 rounded bg-[#f0eee5] py-[3px] pl-2.25 pr-[5px] font-mono text-xs font-medium text-fg"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
            className="grid h-4 w-4 place-items-center rounded text-xs text-muted hover:bg-[rgba(10,10,10,0.1)] hover:text-fg"
          >
            ×
          </button>
        </span>
      ))}
      {tags.length < max && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          className="min-w-32 flex-1 border-none bg-transparent p-1 text-[13.5px] outline-none"
          placeholder={
            tags.length === 0 ? "e.g. React, Figma, Python" : "Add another…"
          }
        />
      )}
    </div>
  );
}
