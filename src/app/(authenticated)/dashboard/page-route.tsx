import { redirect } from "next/navigation";
import React from "react";

import { DashboardPageView } from "@/components/dashboard-page-view";
import type { SessionPayload } from "@/lib/auth/token";
import type { DashboardSummary } from "@/modules/dashboard/service";

type DashboardPageDependencies = {
  getSession: () => Promise<SessionPayload | null>;
  createDashboardSummary: (
    userId: string,
    options: { selectedDate?: string | null },
  ) => Promise<DashboardSummary>;
};

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function createDashboardPage({
  getSession,
  createDashboardSummary,
}: DashboardPageDependencies) {
  return async function DashboardPageRoute({ searchParams }: DashboardPageProps) {
    const session = await getSession();

    if (!session) {
      redirect("/login");
    }

    const params = await searchParams;
    const rawTrendDate = params?.trendDate;
    const selectedDate = Array.isArray(rawTrendDate) ? rawTrendDate[0] : rawTrendDate;
    const dashboard = await createDashboardSummary(session.sub, { selectedDate });
    return <DashboardPageView dashboard={dashboard} />;
  };
}
