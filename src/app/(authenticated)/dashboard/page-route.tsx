import { redirect } from "next/navigation";
import React from "react";

import { DashboardPageView } from "@/components/dashboard-page-view";
import type { SessionPayload } from "@/lib/auth/token";
import type { DashboardSummary } from "@/modules/dashboard/service";

type DashboardPageDependencies = {
  getSession: () => Promise<SessionPayload | null>;
  createDashboardSummary: (userId: string) => Promise<DashboardSummary>;
};

export function createDashboardPage({
  getSession,
  createDashboardSummary,
}: DashboardPageDependencies) {
  return async function DashboardPageRoute() {
    const session = await getSession();

    if (!session) {
      redirect("/login");
    }

    const dashboard = await createDashboardSummary(session.sub);
    return <DashboardPageView dashboard={dashboard} />;
  };
}
