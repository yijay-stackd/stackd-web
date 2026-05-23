"use client";

import { useRef, useState } from "react";
import { initials } from "@/utils/student";
import { FILES } from "@/lib/api/profile-files";
import { compressPhotoForUpload } from "@/lib/image-compress";

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  onFileChange?: (file: File | null) => void;
  name: string;
};

export function PhotoUpload({ value, onChange, onFileChange, name }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Generation counter — discards results from a pick that's been
  // superseded by a newer one before its compression resolved.
  const pickGenRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ini = name ? initials(name) : "";
  const previewBorder = value ? "border-solid" : "border-dashed";

  // Browsers suppress the `change` event for the same file twice — clear so
  // the user can retry after an error.
  function resetInput(): void {
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file?: File) {
    if (!file) return;
    setErrorMsg(null);

    // Sanity ceiling — anything past this is a phone burst / RAW the user
    // didn't mean to pick.
    if (file.size > FILES.photo.preCompressMaxBytes) {
      onFileChange?.(null);
      onChange(null);
      setErrorMsg(
        `That image is too large (${Math.round(file.size / 1024 / 1024)} MB). Pick something under ${Math.round(
          FILES.photo.preCompressMaxBytes / 1024 / 1024
        )} MB.`
      );
      resetInput();
      return;
    }

    const myGen = ++pickGenRef.current;
    setBusy(true);
    try {
      const compressed = await compressPhotoForUpload(file);
      if (myGen !== pickGenRef.current) return;

      onFileChange?.(compressed);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (myGen !== pickGenRef.current) return;
        onChange((e.target?.result as string) ?? null);
      };
      reader.readAsDataURL(compressed);
    } catch (err) {
      if (myGen !== pickGenRef.current) return;
      onFileChange?.(null);
      onChange(null);
      // Full diagnostic to console so it can be inspected; user gets a
      // short, actionable message tuned to the most common failure mode.
      console.error("[photo-upload] compression failed", { name: file.name, type: file.type, size: file.size, err });
      const looksHeic =
        /\.(heic|heif)$/i.test(file.name) ||
        file.type === "image/heic" ||
        file.type === "image/heif";
      setErrorMsg(
        looksHeic
          ? "HEIC isn't supported in this browser. On iPhone, retake the photo with Settings → Camera → Formats → Most Compatible, or pick a JPG from your gallery."
          : "Couldn't read that image. Try a JPG or PNG from your gallery."
      );
    } finally {
      if (myGen === pickGenRef.current) setBusy(false);
      resetInput();
    }
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
          accept={FILES.photo.accept}
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          className="font-medium text-fg underline underline-offset-2 disabled:opacity-60"
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Processing…" : value ? "Replace photo" : "Upload a photo"}
        </button>
        <div className="mt-1 text-xs">
          JPG, PNG, or WebP. Square works best. {!value && "(Optional)"}
        </div>
        {errorMsg && (
          <div
            role="alert"
            className="mt-2 rounded-md border border-danger bg-[#fef2f2] px-2.5 py-1.5 font-mono text-[11px] leading-snug tracking-[0.02em] text-danger"
          >
            ↳ {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
