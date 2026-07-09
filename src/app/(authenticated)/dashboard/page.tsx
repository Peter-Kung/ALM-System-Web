import { redirect } from "next/navigation";

import { DashboardPageView } from "@/components/dashboard-page-view";
import { getSessionFromCookies } from "@/lib/auth/session";
import { createDashboardSummaryForUser } from "@/modules/dashboard";

export default async function DashboardPage() {
  const session = await getSessionFromCookies();

  if (!session) {
    redirect("/login");
  }

  const dashboard = await createDashboardSummaryForUser(session.sub);
  return <DashboardPageView dashboard={dashboard} />;
}
