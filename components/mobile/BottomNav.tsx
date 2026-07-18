"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, GraduationCap, Home, MapPin, Search } from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/feed", label: "Learn", icon: GraduationCap },
  { href: "/analyze", label: "Analyze", icon: Search },
  { href: "/bills", label: "Bills", icon: FileText },
  { href: "/district", label: "District", icon: MapPin },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "/preview";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className="mobile-bottom-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon aria-hidden="true" size={26} strokeWidth={active ? 3 : 2.35} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
