import type { NextRequest } from "next/server";

import { startUpdateHandler } from "@/app/api/app/deployment/handler";

export async function POST(request: NextRequest) {
  return startUpdateHandler(request);
}
