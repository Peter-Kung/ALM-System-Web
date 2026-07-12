import { NextResponse, type NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { createDashboardTrendForUser } from "@/modules/dashboard";

type RequireApiSession = typeof requireApiSession;

export type DashboardTrendHandlerDependencies = {
  createDashboardTrend: typeof createDashboardTrendForUser;
  requireSession: RequireApiSession;
};

export const defaultDashboardTrendHandlerDependencies: DashboardTrendHandlerDependencies = {
  createDashboardTrend: createDashboardTrendForUser,
  requireSession: requireApiSession,
};

function getTrendDate(request: NextRequest) {
  return request.nextUrl.searchParams.get("trendDate");
}

export async function getDashboardTrendHandler(
  request: NextRequest,
  dependencies: DashboardTrendHandlerDependencies = defaultDashboardTrendHandlerDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  const trend = await dependencies.createDashboardTrend(session.sub, {
    selectedDate: getTrendDate(request),
  });

  return NextResponse.json({ trend });
}
