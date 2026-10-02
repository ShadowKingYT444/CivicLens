import type { ReactNode } from "react";
import Link from "next/link";
import { BottomNav } from "./BottomNav";

export function MobileAppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-stage">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="phone-canvas">
        <main id="main" className="mobile-main" tabIndex={-1}>
          {children}
          <footer className="secondary-links" aria-label="Secondary links">
            <Link href="/methodology">Methodology</Link>
            <Link href="/admin">Admin</Link>
          </footer>
        </main>
        <BottomNav />
      </div>
    </div>
  );
}
