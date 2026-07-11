import { NextRequest } from "next/server";

import { completeAccountActivationHandler } from "@/app/api/auth/account-activation/handler";

export async function POST(request: NextRequest) {
  return completeAccountActivationHandler(request);
}
