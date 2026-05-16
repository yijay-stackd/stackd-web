"use client";

import type { ContactType } from "@/types/student";
import { contactLabel, formatContact } from "@/utils/student";

type Props = {
  contactType: ContactType;
  contact: string;
  cvDataUrl?: string | null;
  cvName: string | null;
};

export function ProfileContact({ contactType, contact, cvDataUrl, cvName }: Props) {
  const href = formatContact(contactType, contact);
  const copy = contactLabel(contactType);
  const value = contact.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const hasCv = !!(cvDataUrl || cvName);

  function handleCvDownload(e: React.MouseEvent<HTMLAnchorElement>) {
    if (cvDataUrl) return;
    e.preventDefault();
    alert("This is sample data — the real CV would download here.");
  }

  return (
    <div className="flex flex-col gap-2.5">
      <a
        className="group/cta flex w-full items-center justify-between rounded-[14px] bg-accent px-5.5 py-4.5 text-[17px] font-semibold tracking-[-0.01em] text-accent-fg shadow-cta transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-cta-hover"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>
          {copy}
          <span className="mt-0.5 block font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-[rgb(10_10_10/0.6)]">
            {value}
          </span>
        </span>
        <span className="text-[22px] transition-transform duration-200 group-hover/cta:translate-x-0.75">
          →
        </span>
      </a>
      {hasCv && (
        <a
          className="flex items-center gap-2.5 rounded-[14px] border border-line-2 bg-white px-4.5 py-3.5 text-sm font-medium text-fg transition-[background,border-color,transform] duration-150 hover:-translate-y-px hover:border-fg hover:bg-[#f8f6ee]"
          href={cvDataUrl || "#"}
          download={cvName || "cv.pdf"}
          onClick={handleCvDownload}
        >
          <svg
            className="shrink-0 text-muted"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M8 1V11M8 11L4 7M8 11L12 7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M2 13V14C2 14.5523 2.44772 15 3 15H13C13.5523 15 14 14.5523 14 14V13"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Download CV
          <span className="ml-auto font-mono text-[11px] tracking-[0.02em] text-muted">
            {cvName}
          </span>
        </a>
      )}
    </div>
  );
}
