const SHIMMER =
  "inline-block bg-[linear-gradient(90deg,#ececea_0%,#f5f3ec_50%,#ececea_100%)] [background-size:200%_100%] [animation:shimmer_1.4s_linear_infinite]";

export function FeedSkeleton() {
  return (
    <div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="pointer-events-none grid cursor-default items-center gap-5 border-b border-line py-5.5 grid-cols-[28px_56px_1fr_auto_18px] max-[720px]:grid-cols-[48px_1fr_auto] max-[720px]:gap-3.5 max-[720px]:py-4.5"
        >
          <div className={`${SHIMMER} h-2.5 w-4.5 rounded max-[720px]:hidden`} />
          <div className={`${SHIMMER} h-14 w-14 rounded-md max-[720px]:h-12 max-[720px]:w-12`} />
          <div className="flex flex-col gap-1.5">
            <div className={`${SHIMMER} h-3.5 w-40 rounded`} />
            <div className={`${SHIMMER} h-2.5 w-60 rounded`} />
            <div className={`${SHIMMER} h-2.5 w-48 rounded`} />
          </div>
          <div className="flex gap-1 max-[720px]:hidden">
            <div className={`${SHIMMER} h-4.5 w-13 rounded`} />
            <div className={`${SHIMMER} h-4.5 w-13 rounded`} />
          </div>
          <div className="max-[720px]:hidden" />
        </div>
      ))}
    </div>
  );
}
