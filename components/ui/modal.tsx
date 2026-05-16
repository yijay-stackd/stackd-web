"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-300 grid animate-fadeIn place-items-center bg-[rgba(10,10,10,0.45)] p-5 backdrop-blur-[6px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-110 rounded-[18px] bg-white p-7 pt-8 pb-6 shadow-[0_8px_16px_-8px_rgba(0,0,0,0.2),0_32px_80px_-16px_rgba(0,0,0,0.4)]"
        style={{
          animation: "modalIn 0.24s cubic-bezier(0.2,1.2,0.4,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes modalIn { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
        {children}
      </div>
    </div>,
    document.body
  );
}
