import Link from "next/link";

export function FeedEmpty() {
  return (
    <div className="py-20 text-center">
      <h3 className="mb-2 text-[22px] font-semibold tracking-[-0.02em]">
        No one matches that.
      </h3>
      <p className="mb-6 text-muted">Try a different search — or be the first.</p>
      <Link
        href="/join"
        className="inline-flex items-center gap-2 rounded-full border border-transparent bg-accent px-5.5 py-3.5 text-[15px] font-semibold text-accent-fg transition-[background,color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-btn-hover active:translate-y-0"
      >
        Create your profile
      </Link>
    </div>
  );
}
