import { initials } from "@/utils/student";
import { relativeTime } from "@/utils/relative-time";
import type { Student } from "@/types/student";
import { AvatarImage } from "@/components/ui/avatar-image";

type Props = {
  student: Student;
};

export function EditHeader({ student }: Props) {
  const ago = relativeTime(student.updatedAt || student.addedAt);
  return (
    <div className="mb-11 flex items-center gap-4.5 rounded-lg border border-line bg-white p-5">
      <div
        className="grid h-13 w-13 shrink-0 place-items-center overflow-hidden rounded-[10px] text-[17px] font-semibold tracking-[-0.02em] text-[rgba(10,10,10,0.55)]"
        style={{ background: student.photoColor }}
      >
        <AvatarImage
          src={student.photo ?? null}
          alt=""
          className="h-full w-full object-cover"
          fallback={<span>{initials(student.name)}</span>}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.08em] text-muted">
          Editing your profile
        </div>
        <div className="mb-1.5 truncate text-lg font-semibold leading-tight tracking-[-0.02em]">
          {student.name}
        </div>
        <div className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.04em] text-muted">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulseDot rounded-full bg-accent shadow-accent-ring" />
          Live · last edited {ago}
        </div>
      </div>
    </div>
  );
}
