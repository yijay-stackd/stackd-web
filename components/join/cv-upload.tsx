"use client";

const MAX_CV_BYTES = 5 * 1024 * 1024;

type Props = {
  cvName: string | null;
  onChange: (dataUrl: string | null, name: string | null) => void;
};

export function CvUpload({ cvName, onChange }: Props) {
  if (cvName) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-line-2 bg-white px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <svg
            className="shrink-0 text-muted"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M9 1.5H4C3.45 1.5 3 1.95 3 2.5V13.5C3 14.05 3.45 14.5 4 14.5H12C12.55 14.5 13 14.05 13 13.5V5.5L9 1.5Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path
              d="M9 1.5V5.5H13"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[13px] text-fg">
            {cvName}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onChange(null, null)}
          className="text-xs text-muted underline underline-offset-2 hover:text-danger"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <label className="flex cursor-pointer items-center gap-3.5 rounded-md border-[1.5px] border-dashed border-line-2 bg-white px-4.5 py-4 transition-[border-color,background] duration-150 hover:border-fg hover:bg-[#fdfcf5]">
      <svg
        className="shrink-0 text-muted"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
      >
        <path
          d="M10 3V13M10 13L6 9M10 13L14 9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 15V16C3 16.55 3.45 17 4 17H16C16.55 17 17 16.55 17 16V15"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <span>
        <strong className="block text-sm font-medium text-fg">
          Upload your CV
        </strong>
        <span className="mt-0.5 block font-mono text-[11px] tracking-[0.02em] text-muted">
          PDF, up to 5MB
        </span>
      </span>
      <input
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          if (file.size > MAX_CV_BYTES) {
            alert("File too big — keep it under 5MB");
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            onChange((ev.target?.result as string) ?? null, file.name);
          };
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}
