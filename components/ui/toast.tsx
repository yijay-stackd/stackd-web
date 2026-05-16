"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  message: string;
  duration?: number;
  onDone: () => void;
};

export function Toast({ open, message, duration = 2200, onDone }: Props) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(id);
  }, [open, duration, onDone]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      className="fixed bottom-8 left-1/2 z-250 -translate-x-1/2 rounded-full bg-fg py-2.75 pl-3.5 pr-4.5 text-[13.5px] font-medium text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.3)]"
      style={{
        animation:
          "toastIn 0.3s cubic-bezier(0.2,1.2,0.4,1) both, toastOut 0.3s ease 1.9s both",
      }}
    >
      <style>{`
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes toastOut { to { opacity: 0; transform: translateX(-50%) translateY(8px); } }
      `}</style>
      <span className="inline-flex items-center gap-2">
        <svg
          className="text-accent"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M3 7L6 10L11 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {message}
      </span>
    </div>,
    document.body
  );
}
