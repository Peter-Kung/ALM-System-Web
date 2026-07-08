import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { createDashboardSummaryForUser } from "@/modules/dashboard";

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const dashboard = await createDashboardSummaryForUser(session.sub);

  return NextResponse.json({ dashboard });
}
