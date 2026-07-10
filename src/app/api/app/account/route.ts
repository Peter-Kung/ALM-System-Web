import type { NextRequest } from "next/server";

import { patchAccountHandler } from "@/app/api/app/account/handler";

export async function PATCH(request: NextRequest) {
  return patchAccountHandler(request);
}
