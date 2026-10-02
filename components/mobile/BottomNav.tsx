"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, BookOpen, Home, MapPin, Search } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Learn", icon: BookOpen },
  { href: "/analyze", label: "Analyze", icon: Search },
  { href: "/bills", label: "Bills", icon: FileText },
  { href: "/district", label: "District", icon: MapPin },
];

export function BottomNav({
  variant = "mobile",
}: {
  variant?: "mobile" | "sidebar";
}) {
  const pathname = usePathname();
  return (
    <nav
      className={
        variant === "sidebar" ? "editorial-side-nav" : "mobile-bottom-nav"
      }
      aria-label={
        variant === "sidebar" ? "Desktop navigation" : "Primary navigation"
      }
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/" || pathname === "/preview"
            : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className="mobile-bottom-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
