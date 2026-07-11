import { type NextRequest } from "next/server";

import { requestUserPasswordResetHandler } from "@/app/api/admin/users/[userId]/password-reset-request/handler";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return requestUserPasswordResetHandler(userId);
}
