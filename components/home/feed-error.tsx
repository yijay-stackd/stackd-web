"use client";

type Props = {
  onRetry?: () => void;
};

export function FeedError({ onRetry }: Props) {
  return (
    <div className="flex flex-col items-center py-15 text-center">
      <div className="mx-auto mb-6 grid h-22 w-22 place-items-center rounded-lg bg-[#fff0ec] text-danger">
        <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 4L29 27H3L16 4Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M16 13V19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="16" cy="22.5" r="1.1" fill="currentColor" />
        </svg>
      </div>
      <h3 className="mb-2 text-balance text-[22px] font-semibold tracking-[-0.02em]">
        Couldn&apos;t load profiles.
      </h3>
      <p className="mb-6 max-w-100 text-pretty text-muted">
        Something went wrong on our end. Give it another try.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line-2 bg-transparent px-4 py-2.25 text-sm font-medium text-fg transition-[background,color,transform] duration-150 hover:-translate-y-px hover:bg-white active:translate-y-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}
