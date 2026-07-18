import type { ReactNode } from "react";
import { MobileAppShell } from "./mobile/MobileAppShell";

export function SiteShell({ children }: { children: ReactNode }) {
  return <MobileAppShell>{children}</MobileAppShell>;
}
