import { NextRequest } from "next/server";

import { completePasswordResetHandler } from "@/app/api/auth/password-reset/handler";

export async function POST(request: NextRequest) {
  return completePasswordResetHandler(request);
}
