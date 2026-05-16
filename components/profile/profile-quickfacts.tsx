type Props = {
  location: string | null;
  availabilityText: string | null;
  internshipLength: string | null;
};


export function ProfileQuickFacts({
  location,
  availabilityText,
  internshipLength,
}: Props) {
  return (
    <div className="-mt-2 mb-6 flex flex-wrap gap-x-5.5 gap-y-3.5">
      {location && (
        <div className="inline-flex items-center gap-1.75 text-[13.5px] text-muted">
          <svg
            className="shrink-0 text-muted-2"
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
          >
            <path
              d="M7 13C7 13 12 8.5 12 5.5C12 2.74 9.76 0.5 7 0.5C4.24 0.5 2 2.74 2 5.5C2 8.5 7 13 7 13Z"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <circle cx="7" cy="5.5" r="1.7" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          {location}
        </div>
      )}
      {availabilityText && (
        <div className="inline-flex items-center gap-1.75 text-[13.5px] text-muted">
          <svg
            className="shrink-0 text-muted-2"
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
          >
            <rect
              x="1.5"
              y="2.5"
              width="11"
              height="10"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M4 1V4M10 1V4M1.5 6H12.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          {availabilityText}
        </div>
      )}
      {internshipLength && (
        <div className="inline-flex items-center gap-1.75 text-[13.5px] text-muted">
          <svg
            className="shrink-0 text-muted-2"
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
          >
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
            <path
              d="M7 4V7L9 8.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {internshipLength} internship
        </div>
      )}
    </div>
  );
}
