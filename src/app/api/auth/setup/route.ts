import { NextRequest } from "next/server";

import { setupHandler } from "@/app/api/auth/setup/handler";

export async function POST(request: NextRequest) {
  return setupHandler(request);
}
