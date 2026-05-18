"use client";

type Props = {
  onDelete: () => void;
};

export function DangerZone({ onDelete }: Props) {
  return (
    <div className="mt-16 border-t border-dashed border-line-2 pt-7">
      <div className="mb-3.5">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-danger before:h-1.25 before:w-1.25 before:rounded-full before:bg-danger before:content-['']">
          Danger zone
        </span>
      </div>
      <div className="flex items-center gap-4 rounded-md border border-[#f0d6d6] bg-[#fdf4f3] p-5 transition-[border-color,background] duration-200 hover:border-[#e8c2c2] hover:bg-[#fbecea]">
        <div className="min-w-0 flex-1">
          <strong className="mb-0.75 block text-sm font-semibold text-fg">
            Delete your profile
          </strong>
          <span className="block text-[13px] text-muted">
            Removes your profile from stackd. Your sign-in stays — you can build a new one later. This cannot be undone.
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-full border border-[#ecc6c6] bg-white px-4 py-2.25 text-sm font-medium text-danger transition-[background,border-color,color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-danger hover:shadow-[0_4px_14px_-6px_rgba(201,58,58,0.25)] active:translate-y-0 active:scale-[0.98]"
        >
          Delete profile
        </button>
      </div>
    </div>
  );
}
