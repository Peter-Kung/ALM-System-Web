import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { formatDashboardAmount } from "@/components/dashboard-amount-format";
import { WorkspaceMutationBoundary } from "@/components/workspace-mutation-boundary";
import { getSessionFromCookies } from "@/lib/auth/session";
import { ensureConfiguredAdministrator, validateSessionPayload } from "@/modules/auth";
import { createAuthRepository } from "@/modules/auth/repository";
import { createDashboardSummaryForUser } from "@/modules/dashboard";
import type { DashboardSidebarSummary } from "@/modules/dashboard/service";

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getSessionFromCookies();
  const repository = createAuthRepository();
  await ensureConfiguredAdministrator(repository);

  if (!session) {
    redirect("/login");
  }

  const validSession = await validateSessionPayload(session, repository);
  if (!validSession) {
    redirect("/login");
  }

  const dashboard = await createDashboardSummaryForUser(validSession.sub);
  return (
    <AppShell
      displayName={validSession.displayName}
      role={validSession.role}
      username={validSession.username}
      summary={buildWorkspaceSummary(dashboard.sidebarSummary)}
    >
      <WorkspaceMutationBoundary>{children}</WorkspaceMutationBoundary>
    </AppShell>
  );
}

export function buildWorkspaceSummary(summary: DashboardSidebarSummary) {
  if (!summary.hasSnapshot || !summary.snapshotAt || !summary.netWorth || !summary.baseCurrency) {
    return {
      latestSnapshotLabel: "No snapshot saved yet",
      netWorthLabel: "Awaiting baseline",
      snapshotStatusLabel: "Not started",
      metricRows: [
        { label: "Cash", value: "No data" },
        { label: "Investments", value: "No data" },
        { label: "Debt", value: "No data" },
      ],
      reminderLabel: summary.reminderLabel,
    };
  }

  return {
    latestSnapshotLabel: `Latest snapshot ${formatSnapshotDateTime(summary.snapshotAt)}`,
    netWorthLabel: formatSnapshotPulseAmount(summary.netWorth, summary.baseCurrency),
    snapshotStatusLabel: summary.status === "COMPLETE" ? "Complete" : "Incomplete",
    metricRows: [
      {
        label: "Cash",
        value: formatMetricValue(summary.cashPosition, summary.baseCurrency),
      },
      {
        label: "Investments",
        value: formatMetricValue(summary.investmentValue, summary.baseCurrency),
      },
      {
        label: "Debt",
        value: formatMetricValue(summary.totalLiabilities, summary.baseCurrency),
      },
    ],
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

function formatMetricValue(value: string | null, currency: string) {
  if (!value) {
    return `0.00 ${currency}`;
  }

  return formatSnapshotPulseAmount(value, currency);
}

function formatSnapshotPulseAmount(value: string, currency: string) {
  return formatDashboardAmount(value, currency);
}
