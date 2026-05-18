"use client";

import Link from "next/link";
import { useProfileBySlug } from "./use-profile-by-slug";
import { useFetchSignedCv } from "./use-profile-files";
import { toStudent } from "@/lib/api/profile-mapper";
import { ApiError } from "@/lib/http/errors";
import { formatAvailability, initials, statusLabel } from "@/utils/student";
import { ProfileQuickFacts } from "./profile-quickfacts";
import { ProfileContact } from "./profile-contact";
import { ProfileNotFound } from "./profile-not-found";

type Props = {
  slug: string;
};

export function ProfileDetail({ slug }: Props) {
  const { data, isLoading, error } = useProfileBySlug(slug);
  const fetchSignedCv = useFetchSignedCv();

  async function handleCvDownload() {
    if (!data?.cv_key) return;
    try {
      const { url } = await fetchSignedCv.mutateAsync(data.id);
      window.open(url, "_blank", "noopener");
    } catch {
      // Error surfaces via fetchSignedCv.error → ProfileContact renders inline.
    }
  }

  if (isLoading) {
    return <ProfileDetailSkeleton />;
  }

  // Backend returns 404 → ApiError(status=404). Anything else is real.
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <ProfileNotFound />;
    }
    return (
      <div className="mx-auto max-w-220 px-7 py-20 text-center">
        <p className="text-[15px] text-muted">
          Couldn&apos;t load this profile.
        </p>
      </div>
    );
  }

  if (!data) return <ProfileNotFound />;

  const student = toStudent(data);
  const availabilityText = formatAvailability(student.availability);

  return (
    <div className="animate-pageIn">
      <div className="mx-auto max-w-220 px-7 max-[640px]:px-5">
        <Link
          className="my-8 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
          href="/"
        >
          ← Back to directory
        </Link>

        <article className="grid grid-cols-[200px_1fr] items-start gap-10 pb-20 max-[720px]:grid-cols-1 max-[720px]:gap-6">
          <div className="relative h-50 w-50 overflow-hidden rounded-[14px] border border-line bg-[#f1efe6] max-[720px]:h-35 max-[720px]:w-35">
            {student.photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={student.photo}
                alt={student.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{ background: student.photoColor }}
              >
                <span className="absolute inset-0 grid place-items-center text-[80px] font-semibold tracking-[-0.04em] text-[rgba(10,10,10,0.5)]">
                  {initials(student.name)}
                </span>
              </div>
            )}
          </div>

          <div>
            {student.openTo.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {student.openTo.map((id, i) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-[#f0eee2] px-3 py-1.25 font-mono text-xs font-medium tracking-[0.02em] text-fg whitespace-nowrap"
                  >
                    {i === 0 && (
                      <span className="h-1.5 w-1.5 shrink-0 animate-pulseDot rounded-full bg-accent shadow-accent-ring" />
                    )}
                    Open to {statusLabel(id).toLowerCase()}
                  </span>
                ))}
              </div>
            )}
            <h1 className="mb-3 text-[clamp(32px,4.4vw,44px)] font-semibold leading-none tracking-[-0.03em]">
              {student.name}
            </h1>
            <div className="mb-6 text-[15px] leading-normal text-muted">
              <strong className="font-medium text-fg">
                {student.university}
              </strong>
              <br />
              {student.course} · {student.year} year
            </div>

            <ProfileQuickFacts
              location={student.location}
              availabilityText={availabilityText}
              internshipLength={student.internshipLength}
            />

            <p className="mb-8 border-y border-line py-5 text-[17px] leading-normal tracking-[-0.005em] text-pretty">
              {student.bio}
            </p>

            <div className="mb-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              Skills
            </div>
            <div className="mb-8 flex flex-wrap gap-1.5">
              {student.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-[5px] bg-[#f0eee5] px-2.5 py-1.25 font-mono text-xs font-medium tracking-[0.02em] text-fg"
                >
                  {t}
                </span>
              ))}
            </div>

            <ProfileContact
              contactType={student.contactType}
              contact={student.contact}
              cvName={student.cvName}
              onCvDownload={handleCvDownload}
              cvDownloading={fetchSignedCv.isPending}
              cvDownloadError={
                fetchSignedCv.error instanceof Error
                  ? fetchSignedCv.error.message
                  : null
              }
            />
          </div>
        </article>
      </div>

      <div className="mx-auto max-w-220 px-7 max-[640px]:px-5">
        <footer className="flex flex-wrap justify-between gap-2.5 border-t border-line py-6 pb-9 font-mono text-[11px] tracking-[0.04em] text-muted">
          <span>stackd · spring 2026</span>
          <Link href="/">← back to directory</Link>
        </footer>
      </div>
    </div>
  );
}

function ProfileDetailSkeleton() {
  return (
    <div className="mx-auto max-w-220 px-7 py-20 max-[640px]:px-5">
      <div className="h-50 w-50 animate-pulse rounded-[14px] bg-[#f1efe6]" />
      <div className="mt-8 h-10 w-2/3 animate-pulse rounded bg-[#f1efe6]" />
      <div className="mt-3 h-5 w-1/2 animate-pulse rounded bg-[#f1efe6]" />
    </div>
  );
}
