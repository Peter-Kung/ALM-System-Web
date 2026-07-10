import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  return NextResponse.json({ session });
}
