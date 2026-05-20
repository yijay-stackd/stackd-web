"use client";

import { useRouter } from "next/navigation";
import { initials, statusLabel, yearLabel } from "@/utils/student";
import type { Student } from "@/types/student";

type Props = {
  student: Student;
  index: number;
  isNew: boolean;
  onTagClick: (tag: string) => void;
};


export function StudentRow({ student, index, isNew, onTagClick }: Props) {
  const router = useRouter();
  const num = String(index + 1).padStart(2, "0");

  return (
    <article
      className="group relative grid cursor-pointer animate-rowIn items-center gap-5 border-b border-line py-5.5 grid-cols-[28px_56px_1fr_auto_18px] transition-[background] duration-150 hover:bg-row-hover max-[720px]:grid-cols-[48px_1fr_auto] max-[720px]:gap-3.5 max-[720px]:py-4.5"
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      onClick={() => router.push(`/profile/${student.slug}`)}
    >
      <div className="font-mono text-[11px] tracking-[0.04em] text-muted-2 max-[720px]:hidden">
        {num}
      </div>
      <div
        className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-[10px] text-[18px] font-semibold tracking-[-0.02em] text-[rgba(10,10,10,0.55)] transition-transform duration-[250ms] group-hover:scale-[1.04] max-[720px]:h-12 max-[720px]:w-12 max-[720px]:text-[15px]"
        style={{ background: student.photoColor }}
      >
        {student.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="h-full w-full object-cover" src={student.photo} alt="" />
        ) : (
          <span>{initials(student.name)}</span>
        )}
        {isNew && (
          <span className="absolute -top-[3px] -right-[3px] h-[14px] w-[14px] rounded-full border-2 border-bg bg-accent" />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[17px] font-semibold leading-[1.2] tracking-[-0.018em]">
            {student.name}
          </span>
          {student.openTo.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              {student.openTo.slice(0, 2).map((id, idx) => (
                <span key={id} className="inline-flex items-center gap-1.5 font-mono text-[10.5px] font-medium tracking-[0.02em] text-fg whitespace-nowrap rounded-full border border-line-2 bg-[#f0eee2] py-[2px] pr-[9px] pl-[7px]">
                  {idx === 0 && (
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulseDot rounded-full bg-accent shadow-accent-ring" />
                  )}
                  {statusLabel(id).toLowerCase()}
                </span>
              ))}
              {student.openTo.length > 2 && (
                <span className="inline-flex items-center font-mono text-[10.5px] font-medium tracking-[0.02em] text-muted whitespace-nowrap rounded-full border border-line-2 bg-transparent py-[2px] px-[7px]">
                  +{student.openTo.length - 2}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-muted">
          {[student.university, student.course, yearLabel(student.year)]
            .filter(Boolean)
            .join(" · ")}
        </div>
        <div className="mt-1.5 text-[13.5px] text-fg opacity-[0.78] line-clamp-1 max-[720px]:line-clamp-2">
          {student.bio}
        </div>
      </div>
      <div className="flex max-w-[240px] flex-wrap justify-end gap-1 max-[720px]:hidden">
        {student.tags.slice(0, 3).map((t) => (
          <button
            key={t}
            className="whitespace-nowrap rounded-[4px] bg-[#efece1] px-[7px] py-[3px] font-mono text-[10.5px] font-medium tracking-[0.02em] text-fg transition-[background] duration-[120ms] hover:bg-accent"
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(t);
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="text-muted-2 transition-[color,transform] duration-[180ms] group-hover:translate-x-[3px] group-hover:text-fg max-[720px]:hidden">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M3 7H11M11 7L7 3M11 7L7 11"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </article>
  );
}
