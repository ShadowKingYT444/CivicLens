import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "teal" | "yellow" | "purple" | "blue" | "danger" | "success";
  className?: string;
}) {
  return <span className={`mobile-pill mobile-pill-${tone} ${className}`}>{children}</span>;
}
