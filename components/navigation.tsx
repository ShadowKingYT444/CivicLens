"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const desktopNav = [
  { href: "/", label: "Dashboard" },
  { href: "/feed", label: "Feed" },
  { href: "/analyze", label: "Analyze" },
  { href: "/bills", label: "Bills" },
  { href: "/district", label: "District" },
  { href: "/methodology", label: "Methodology" },
  { href: "/admin", label: "Admin" },
];

const mobileNav = desktopNav.slice(0, 5);

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation() {
  const pathname = usePathname();

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <Link className="brand" href="/" aria-label="CivicLens dashboard">
            <span className="brand-mark" aria-hidden="true">
              CL
            </span>
            <span className="brand-copy">
              <strong>CivicLens</strong>
              <span>Evidence-first civic literacy</span>
            </span>
          </Link>
          <nav className="nav-links" aria-label="Primary navigation">
            {desktopNav.map((item) => (
              <Link
                key={item.href}
                className="nav-link"
                href={item.href}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        <div className="mobile-bottom-nav-inner">
          {mobileNav.map((item) => (
            <Link
              key={item.href}
              className="mobile-nav-link"
              href={item.href}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
