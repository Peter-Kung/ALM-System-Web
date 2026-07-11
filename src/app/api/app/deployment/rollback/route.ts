import type { NextRequest } from "next/server";

import { startRollbackHandler } from "@/app/api/app/deployment/handler";

export async function POST(request: NextRequest) {
  return startRollbackHandler(request);
}
