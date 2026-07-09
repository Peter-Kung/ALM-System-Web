import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getSessionFromCookies } from "@/lib/auth/session";
import { createDashboardSummaryForUser } from "@/modules/dashboard";
import type { DashboardSidebarSummary } from "@/modules/dashboard/service";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const dashboard = await createDashboardSummaryForUser(session.sub);
  return (
    <AppShell
      username={session.username}
      summary={buildWorkspaceSummary(dashboard.sidebarSummary)}
    >
      {children}
    </AppShell>
  );
}

function buildWorkspaceSummary(summary: DashboardSidebarSummary) {
  if (!summary.hasSnapshot || !summary.snapshotAt || !summary.netWorth || !summary.baseCurrency) {
    return {
      latestSnapshotLabel: "No snapshot saved yet",
      netWorthLabel: "Awaiting baseline",
      snapshotStatusLabel: "Not started",
      reminderLabel: summary.reminderLabel,
    };
  }

  return {
    latestSnapshotLabel: `Latest snapshot ${formatSnapshotDateTime(summary.snapshotAt)}`,
    netWorthLabel: `${summary.netWorth} ${summary.baseCurrency}`,
    snapshotStatusLabel: summary.status === "COMPLETE" ? "Complete" : "Incomplete",
    reminderLabel: summary.reminderLabel,
  };
}

function formatSnapshotDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}
