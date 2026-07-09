"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { AppShellFrame, type WorkspaceSummary } from "@/components/app-shell-frame";

type AppShellProps = {
  children: ReactNode;
  username: string;
  summary: WorkspaceSummary;
};

export function AppShell({ children, username, summary }: AppShellProps) {
  const pathname = usePathname();

  return (
    <AppShellFrame pathname={pathname} username={username} summary={summary}>
      {children}
    </AppShellFrame>
  );
}
