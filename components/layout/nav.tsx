"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { useMyProfile } from "@/features/profile/use-my-profile";
import { toStudent } from "@/lib/api/profile-mapper";
import { initials } from "@/utils/student";

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { data: myProfile } = useMyProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const onFeed = pathname === "/";
  const onJoin = pathname === "/join";
  const onLogin = pathname === "/login";

  const currentStudent = myProfile ? toStudent(myProfile) : null;

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function avatarChar() {
    if (currentStudent) return initials(currentStudent.name);
    if (user?.email) return user.email[0].toUpperCase();
    return "?";
  }

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    router.push("/");
  }

  function goAndClose(href: string) {
    setMenuOpen(false);
    router.push(href);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-header backdrop-blur-[14px]">
      <div className="mx-auto flex h-13 max-w-220 items-center justify-between px-7 max-[640px]:px-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          stackd
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link
            href="/"
            className={`px-3 py-1.75 text-sm font-medium rounded-full transition-colors duration-150 hover:text-fg ${
              onFeed ? "text-fg bg-[#ebe9e0]" : "text-muted"
            }`}
          >
            Browse
          </Link>

          {!user && (
            <>
              <Link
                href="/login"
                className={`px-3 py-1.75 text-sm font-medium rounded-full transition-colors duration-150 hover:text-fg ${
                  onLogin ? "text-fg bg-[#ebe9e0]" : "text-muted"
                }`}
              >
                Sign in
              </Link>
              <Link
                href="/join"
                className={`px-3.5 py-1.75 text-sm font-semibold rounded-full bg-accent text-accent-fg transition-[background,color,box-shadow] duration-150 hover:shadow-btn-hover ${
                  onJoin ? "" : ""
                }`}
              >
                Join
              </Link>
            </>
          )}

          {user && (
            <div className="relative ml-1" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className={`inline-flex items-center gap-1.5 rounded-full border bg-white py-0.75 pl-0.75 pr-2.25 transition-[border-color,background] duration-150 hover:border-fg ${
                  menuOpen ? "border-fg bg-bg-hover" : "border-line-2"
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center overflow-hidden rounded-full text-[11px] ${
                    currentStudent
                      ? "font-semibold"
                      : "border border-dashed border-line-2 font-medium text-muted"
                  }`}
                  style={
                    currentStudent
                      ? {
                          background: currentStudent.photoColor || "#0a0a0a",
                          color: "rgba(10,10,10,0.7)",
                        }
                      : undefined
                  }
                >
                  {currentStudent && currentStudent.photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={currentStudent.photo}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{avatarChar()}</span>
                  )}
                </span>
                <svg
                  className="text-muted"
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                >
                  <path
                    d="M1 1L5 5L9 1"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] z-100 min-w-60 rounded-xl border border-line-2 bg-white p-1.5 shadow-[0_4px_8px_-4px_rgba(0,0,0,0.06),0_16px_36px_-12px_rgba(0,0,0,0.18)]"
                  style={{
                    animation:
                      "popIn 0.16s cubic-bezier(0.2,0.8,0.2,1) both",
                  }}
                >
                  <style>{`@keyframes popIn { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
                  {currentStudent ? (
                    <>
                      <div className="px-3 pt-2.5 pb-2">
                        <div className="text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">
                          {currentStudent.name}
                        </div>
                        <div className="mt-0.75 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] tracking-[0.02em] text-muted">
                          {user.email}
                        </div>
                      </div>
                      <div className="my-1 h-px bg-line" />
                      <MenuItem
                        onClick={() =>
                          goAndClose(`/profile/${currentStudent.slug}`)
                        }
                        icon={
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <circle
                              cx="7"
                              cy="5"
                              r="2.5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                            />
                            <path
                              d="M2 12.5C2 10.5 4 9 7 9C10 9 12 10.5 12 12.5"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinecap="round"
                            />
                          </svg>
                        }
                      >
                        My profile
                      </MenuItem>
                      <MenuItem
                        onClick={() => goAndClose("/profile/me/edit")}
                        icon={
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                          >
                            <path
                              d="M9 2L12 5L5 12H2V9L9 2Z"
                              stroke="currentColor"
                              strokeWidth="1.3"
                              strokeLinejoin="round"
                            />
                          </svg>
                        }
                      >
                        Edit profile
                      </MenuItem>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1.5 px-3.5 py-3.5">
                      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-2">
                        Signed in as
                      </div>
                      <div className="break-all text-[12.5px] leading-snug text-fg">
                        {user.email}
                      </div>
                      <div className="mt-1 border-t border-line pt-2 text-[12px] leading-snug text-muted">
                        No profile yet. You&apos;re not visible to companies.
                      </div>
                      <button
                        type="button"
                        onClick={() => goAndClose("/join")}
                        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-2 text-[12.5px] font-semibold text-accent-fg transition-[background,box-shadow] duration-150 hover:shadow-btn-hover"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            d="M7 2V12M2 7H12"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                        Create profile
                      </button>
                    </div>
                  )}
                  <div className="my-1 h-px bg-line" />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="group/item flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] text-muted transition-[background,color] duration-100 hover:bg-bg-hover hover:text-danger"
                  >
                    <svg
                      className="shrink-0 text-muted transition-colors group-hover/item:text-danger"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                    >
                      <path
                        d="M6 2H3C2.45 2 2 2.45 2 3V11C2 11.55 2.45 12 3 12H6"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                      />
                      <path
                        d="M9 4L12 7L9 10M12 7H6"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {user && !currentStudent && (
            <Link
              href="/join"
              className={`px-3.5 py-1.75 text-sm font-semibold rounded-full bg-accent text-accent-fg transition-[background,color,box-shadow] duration-150 hover:shadow-btn-hover ${
                onJoin ? "" : ""
              }`}
            >
              Join
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function MenuItem({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group/item flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] text-fg transition-[background] duration-100 hover:bg-bg-hover"
    >
      <span className="shrink-0 text-muted transition-colors group-hover/item:text-fg">
        {icon}
      </span>
      {children}
    </button>
  );
}
