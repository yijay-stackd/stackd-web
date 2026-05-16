"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";


export function Nav() {
  const pathname = usePathname();
  const onFeed = pathname === "/";
  const onJoin = pathname === "/join";

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-header backdrop-blur-[14px]">
      <div className="mx-auto flex h-[52px] max-w-220 items-center justify-between px-7 max-[640px]:px-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]"
        >
          <span className="h-2 w-2 rounded-full bg-accent" />
          stackd
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={`px-3 py-[7px] text-sm font-medium rounded-full transition-colors duration-150 hover:text-fg ${onFeed ? "text-fg bg-[#ebe9e0]" : "text-muted"}`}
          >
            Browse
          </Link>
          <Link
            href="/join"
            className={`px-3 py-[7px] text-sm font-medium rounded-full transition-colors duration-150 hover:text-fg ${onJoin ? "text-fg bg-[#ebe9e0]" : "text-muted"}`}
          >
            Join
          </Link>
        </nav>
      </div>
    </header>
  );
}
