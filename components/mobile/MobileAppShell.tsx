"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { BottomNav } from "./BottomNav";

export function MobileAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mobile-stage editorial-stage">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="editorial-sidebar" aria-label="CivicLens workspace">
        <Link className="editorial-brand" href="/" aria-label="CivicLens home">
          <span className="editorial-brand-mark" aria-hidden="true">
            <BookOpen size={22} />
          </span>
          <span>
            CivicLens<small>A civic field guide</small>
          </span>
        </Link>
        <p className="editorial-nav-caption">Explore</p>
        <BottomNav variant="sidebar" />
        <div className="editorial-sidebar-note">
          <span className="editorial-small-label">
            Read. Check. Understand.
          </span>
          <p>
            Start with the source.
            <br />
            Make up your own mind.
          </p>
          <Link href="/methodology">
            Our approach <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </aside>
      <div className="phone-canvas editorial-workspace">
        <header className="editorial-mobile-masthead">
          <Link href="/" aria-label="CivicLens home">
            <BookOpen size={19} aria-hidden="true" /> CivicLens
          </Link>
          <Link href="/methodology">
            Our approach <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </header>
        <main id="main" className="mobile-main" tabIndex={-1}>
          <div className="editorial-route-content" key={pathname}>
            {children}
          </div>
          <footer
            className="secondary-links editorial-footer"
            aria-label="Secondary links"
          >
            <span>Civic understanding, one source at a time.</span>
            <div>
              <Link href="/methodology">Methodology</Link>
              <Link href="/admin">Admin</Link>
            </div>
          </footer>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
