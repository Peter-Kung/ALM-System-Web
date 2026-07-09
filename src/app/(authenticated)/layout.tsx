import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { getSessionFromCookies } from "@/lib/auth/session";
import { formatUtcDateTime } from "@/lib/date-format";
import { createDashboardSummaryForUser } from "@/modules/dashboard";

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
  const latestSnapshot = dashboard.latestSnapshot;

  const summary = latestSnapshot
    ? {
        latestSnapshotLabel: `Latest snapshot ${formatUtcDateTime(latestSnapshot.snapshotAt)}`,
        netWorthLabel: `${latestSnapshot.netWorth} ${latestSnapshot.baseCurrency}`,
        snapshotStatusLabel:
          latestSnapshot.status === "COMPLETE" ? "Complete" : "Incomplete",
        reminderLabel:
          dashboard.issueMessages[0] ??
          `${latestSnapshot.accountCount} accounts and ${latestSnapshot.holdingCount} holdings represented.`,
      }
    : {
        latestSnapshotLabel: "No snapshot saved yet",
        netWorthLabel: "Awaiting baseline",
        snapshotStatusLabel: "Not started",
        reminderLabel: "Run the first valuation preview to populate the workspace pulse.",
      };

  return (
    <AppShell username={session.username} summary={summary}>
      {children}
    </AppShell>
  );
}
