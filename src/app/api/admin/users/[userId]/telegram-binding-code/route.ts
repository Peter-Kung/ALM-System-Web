import { requestUserTelegramBindingCodeHandler } from "@/app/api/admin/users/[userId]/telegram-binding-code/handler";

export async function POST(
  _request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const { userId } = await context.params;
  return requestUserTelegramBindingCodeHandler(userId);
}
