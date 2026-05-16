"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";

type Props = {
  open: boolean;
  studentName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const CONFIRM_TOKEN = "DELETE";

export function DeleteModal({ open, studentName, onCancel, onConfirm }: Props) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toUpperCase() === CONFIRM_TOKEN;

  function handleClose() {
    setTyped("");
    onCancel();
  }

  function handleConfirm() {
    if (!ready) return;
    setTyped("");
    onConfirm();
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <div className="mb-5 grid h-14 w-14 place-items-center rounded-[14px] bg-[#fff0ec] text-danger">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 4L21 20H3L12 4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M12 10V14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </svg>
      </div>
      <h2 className="mb-2.5 text-[22px] font-semibold leading-[1.15] tracking-[-0.02em]">
        Delete your profile?
      </h2>
      <p className="mb-5.5 text-pretty text-[14.5px] leading-normal text-fg">
        This permanently removes <strong className="font-semibold">{studentName}</strong> from stackd. Your CV, skills, and links are gone — and companies can&apos;t find you. You&apos;ll stay signed in, but you&apos;ll need to build a new profile from scratch. This <strong className="font-semibold">cannot be undone</strong>.
      </p>
      <div className="mb-6">
        <label className="mb-2 block text-[12.5px] text-muted">
          Type{" "}
          <code className="rounded bg-[#f0eee2] px-1.5 py-0.5 font-mono text-[11.5px] font-medium tracking-[0.04em] text-fg">
            {CONFIRM_TOKEN}
          </code>{" "}
          to confirm.
        </label>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus
          placeholder={CONFIRM_TOKEN}
          className="w-full rounded-md border border-line-2 bg-white px-3.5 py-2.75 font-mono text-[14px] tracking-[0.04em] outline-none transition-[border-color,box-shadow] duration-150 focus:border-fg focus:shadow-focus-ring"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-transparent px-4 py-2.25 text-sm font-medium text-fg transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-white active:translate-y-0"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={handleConfirm}
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-danger px-4 py-2.25 text-sm font-semibold text-white transition-[background,box-shadow,transform] duration-150 hover:-translate-y-px hover:bg-[#b62f2f] hover:shadow-[0_6px_20px_-8px_rgba(201,58,58,0.4)] active:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#e9bdbd] disabled:shadow-none disabled:hover:translate-y-0"
        >
          Delete my profile
        </button>
      </div>
    </Modal>
  );
}
