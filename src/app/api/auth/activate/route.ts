import { NextRequest } from "next/server";

import { activateAccountHandler } from "@/app/api/auth/activate/handler";

export async function POST(request: NextRequest) {
  return activateAccountHandler(request);
}
