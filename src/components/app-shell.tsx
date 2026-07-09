"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { AppShellFrame, type WorkspaceSummary } from "@/components/app-shell-frame";
import { IssueReportButton } from "@/components/issue-report-button";

type AppShellProps = {
  children: ReactNode;
  issueReportingEnabled: boolean;
  username: string;
  summary: WorkspaceSummary;
};

export function AppShell({
  children,
  issueReportingEnabled,
  username,
  summary,
}: AppShellProps) {
  const pathname = usePathname();

  return (
    <AppShellFrame
      pathname={pathname}
      username={username}
      summary={summary}
      footerActions={
        issueReportingEnabled ? <IssueReportButton pathname={pathname} /> : null
      }
    >
      {children}
    </AppShellFrame>
  );
}
