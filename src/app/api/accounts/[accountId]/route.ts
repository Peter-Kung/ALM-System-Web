import { AccountType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getBooleanValue,
  getDecimalValue,
  getEnumValue,
  getNullableStringValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { createAccountRepository } from "@/modules/accounts";

const accountRepository = createAccountRepository();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const { accountId } = await params;
    const existingAccount = await accountRepository.findById(accountId);

    if (!existingAccount || existingAccount.userId !== session.sub) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const account = await accountRepository.update(accountId, {
      name: getStringValue(payload, "name"),
      institutionName: getStringValue(payload, "institutionName"),
      accountType: getEnumValue(payload, "accountType", Object.values(AccountType)),
      currency: getStringValue(payload, "currency"),
      cashBalance: getDecimalValue(payload, "cashBalance"),
      isActive: getBooleanValue(payload, "isActive"),
      notes: getNullableStringValue(payload, "notes"),
    });

    return NextResponse.json({ account });
  } catch (error) {
    return handleRouteError(error);
  }
}
