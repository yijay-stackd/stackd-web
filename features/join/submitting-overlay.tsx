type Props = {
  label?: string;
};

export function SubmittingOverlay({ label = "Going live…" }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-200 grid animate-fadeIn place-items-center bg-translucent backdrop-blur-[6px]"
    >
      <div className="max-w-90 px-7 text-center">
        <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-[3px] border-line border-t-fg" />
        <h2 className="mb-1.5 text-[20px] font-semibold tracking-tight">
          {label}
        </h2>
        <p className="text-[13.5px] text-muted">
          Saving your profile, uploading files, and attaching skills…
        </p>
      </div>
    </div>
  );
}
