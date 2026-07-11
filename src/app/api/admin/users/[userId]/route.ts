import { type NextRequest } from "next/server";

import { updateUserHandler } from "@/app/api/admin/users/[userId]/handler";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return updateUserHandler(request, userId);
}
