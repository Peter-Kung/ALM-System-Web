import { type NextRequest } from "next/server";

import { getDashboardTrendHandler } from "@/app/api/dashboard/trend/handler";

export async function GET(request: NextRequest) {
  return getDashboardTrendHandler(request);
}
