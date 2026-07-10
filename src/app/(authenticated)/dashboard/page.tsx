import { createDashboardPage } from "@/app/(authenticated)/dashboard/page-route";
import { getSessionFromCookies } from "@/lib/auth/session";
import { createDashboardSummaryForUser } from "@/modules/dashboard";

export default createDashboardPage({
  getSession: getSessionFromCookies,
  createDashboardSummary: createDashboardSummaryForUser,
});
