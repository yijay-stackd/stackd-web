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
          <div className="mx-auto mb-5 grid h-18 w-18 animate-pop place-items-center rounded-full bg-accent">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path
                d="M10 20L17 27L30 13"
                stroke="#0a0a0a"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
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
