"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { AppShellFrame, type WorkspaceSummary } from "@/components/app-shell-frame";
import type { NavigationRole } from "@/lib/navigation";

type AppShellProps = {
  children: ReactNode;
  displayName?: string | null;
  role: NavigationRole;
  username: string;
  summary: WorkspaceSummary;
};

export function AppShell({ children, displayName, role, username, summary }: AppShellProps) {
  const pathname = usePathname();

  return (
    <AppShellFrame
      pathname={pathname}
      role={role}
      username={username}
      displayName={displayName}
      summary={summary}
    >
      {children}
    </AppShellFrame>
  );
}
