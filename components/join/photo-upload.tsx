"use client";

import { useRef } from "react";
import { initials } from "@/utils/student";

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  name: string;
};

export function PhotoUpload({ value, onChange, name }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ini = name ? initials(name) : "";
  const previewBorder = value ? "border-solid" : "border-dashed";

  function handleFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onChange((e.target?.result as string) ?? null);
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-3.5">
      <div
        className={`grid h-18 w-18 shrink-0 place-items-center overflow-hidden rounded-[10px] border-[1.5px] border-line-2 bg-white font-mono text-[10px] uppercase tracking-[0.04em] text-muted ${previewBorder}`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : ini ? (
          <div
            className="grid h-full w-full place-items-center font-sans text-[26px] font-semibold tracking-[-0.02em] text-[rgba(10,10,10,0.5)]"
            style={{ background: "#FFD9B3" }}
          >
            {ini}
          </div>
        ) : (
          "Photo"
        )}
      </div>
      <div className="text-[13px] text-muted">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          className="font-medium text-fg underline underline-offset-2"
          onClick={() => inputRef.current?.click()}
        >
          {value ? "Replace photo" : "Upload a photo"}
        </button>
        <div className="mt-1 text-xs">
          JPG or PNG. Square works best. {!value && "(Optional)"}
        </div>
      </div>
    </div>
  );
}
