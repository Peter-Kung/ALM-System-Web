import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { refreshAutoPriceRecordsForUser } from "@/modules/prices";

export async function POST() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const result = await refreshAutoPriceRecordsForUser(session.sub);
  return NextResponse.json(result);
}
