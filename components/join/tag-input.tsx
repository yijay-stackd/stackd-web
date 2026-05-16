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
    <div className="flex min-h-11 flex-wrap gap-1.5 rounded-md border border-gray-200 bg-white p-2 focus-within:border-gray-900">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1.5 rounded bg-gray-100 py-1 pl-2 pr-1 font-mono text-xs font-medium text-gray-900"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(tags.filter((x) => x !== t))}
            aria-label={`Remove ${t}`}
            className="grid h-4 w-4 place-items-center rounded text-xs text-gray-500 hover:bg-gray-200 hover:text-gray-900"
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
          className="flex-1 min-w-32 border-none bg-transparent p-1 text-sm outline-none"
          placeholder={
            tags.length === 0 ? "e.g. React, Figma, Python" : "Add another…"
          }
        />
      )}
    </div>
  );
}
