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

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const accounts = await accountRepository.listByUser(session.sub);
  return NextResponse.json({ accounts });
}

export async function POST(request: NextRequest) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const account = await accountRepository.create({
      userId: session.sub,
      name: getStringValue(payload, "name"),
      institutionName: getStringValue(payload, "institutionName"),
      accountType: getEnumValue(payload, "accountType", Object.values(AccountType)),
      currency: getStringValue(payload, "currency"),
      cashBalance: getDecimalValue(payload, "cashBalance"),
      isActive: getBooleanValue(payload, "isActive"),
      notes: getNullableStringValue(payload, "notes"),
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
