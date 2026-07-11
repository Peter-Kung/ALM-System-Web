import { type NextRequest } from "next/server";

import { requestUserActivationHandler } from "@/app/api/admin/users/[userId]/activation-request/handler";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return requestUserActivationHandler(userId);
}
