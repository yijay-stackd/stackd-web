// Standard full-page loading state. Matches the format used during OTP
// verification ("Signing you in…") so every wait-state in the app looks
// the same. Lives outside any transformed ancestor (callers should render
// it as a page-level replacement, not nested inside `animate-pageIn`).

type Props = {
  // Primary line. Short, sentence-case, ends with em-dash ellipsis.
  // Examples: "Signing you in…", "Going live…", "Loading your profile…"
  title: string;
  // Secondary line. Should reassure, not narrate. Keep terse.
  subtitle?: string;
};

export function LoadingPage({ title, subtitle = "Just a moment." }: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fadeIn py-20 text-center"
    >
      <div className="mb-6 inline-flex">
        <span
          className="inline-block h-8 w-8 animate-spin rounded-full border-[2.5px] border-fg border-r-transparent"
          style={{ animationDuration: "0.7s" }}
        />
      </div>
      <h2 className="mb-1.5 text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="text-[15px] text-muted">{subtitle}</p>
    </div>
  );
}
