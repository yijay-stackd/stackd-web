import { Confetti } from "./confetti";

type Props = {
  firstName: string;
};

export function Celebration({ firstName }: Props) {
  return (
    <>
      <Confetti />
      <div className="fixed inset-0 z-200 grid animate-fadeIn place-items-center bg-translucent backdrop-blur-[6px]">
        <div className="max-w-105 px-7 text-center">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="mx-auto mb-5 block animate-pop drop-shadow-[0_8px_24px_rgba(10,10,10,0.18)]"
          >
            <rect width="24" height="24" rx="6" fill="#0a0a0a" />
            <rect
              x="5"
              y="5"
              width="14"
              height="3.8"
              rx="1.3"
              fill="#d6ff3d"
              className="origin-left animate-[barIn_0.45s_cubic-bezier(0.2,0.8,0.2,1)_both]"
              style={{ animationDelay: "60ms" }}
            />
            <rect
              x="5"
              y="10.1"
              width="9.5"
              height="3.8"
              rx="1.3"
              fill="#d6ff3d"
              className="origin-left animate-[barIn_0.45s_cubic-bezier(0.2,0.8,0.2,1)_both]"
              style={{ animationDelay: "180ms" }}
            />
            <rect
              x="5"
              y="15.2"
              width="14"
              height="3.8"
              rx="1.3"
              fill="#d6ff3d"
              className="origin-left animate-[barIn_0.45s_cubic-bezier(0.2,0.8,0.2,1)_both]"
              style={{ animationDelay: "300ms" }}
            />
          </svg>
          <h2 className="mb-2 text-[32px] font-semibold tracking-tight">
            You&apos;re live.
          </h2>
          <p className="mb-6 text-muted">
            Welcome to stackd, {firstName}. Taking you to your profile…
          </p>
        </div>
      </div>
    </>
  );
}
