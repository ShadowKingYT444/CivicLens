import type { ButtonHTMLAttributes, ReactNode } from "react";

export function RoundedButton({
  children,
  tone = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "primary" | "yellow" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button className={`rounded-button rounded-button-${tone} ${className}`} {...props}>
      {children}
    </button>
  );
}
