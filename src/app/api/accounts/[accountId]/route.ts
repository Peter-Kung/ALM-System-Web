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

type AccountStatusRepository = {
  findById(accountId: string): Promise<{ userId: string } | null>;
  update(
    accountId: string,
    data: { isActive: boolean },
  ): Promise<{ isActive: boolean } & Record<string, unknown>>;
};

export async function patchAccountStatusForUser(
  repository: AccountStatusRepository,
  {
    accountId,
    userId,
    isActive,
  }: {
    accountId: string;
    userId: string;
    isActive: boolean;
  },
) {
  const existingAccount = await repository.findById(accountId);

  if (!existingAccount || existingAccount.userId !== userId) {
    return null;
  }

  return repository.update(accountId, {
    isActive,
  });
}

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const { accountId } = await params;
    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const account = await patchAccountStatusForUser(accountRepository, {
      accountId,
      userId: session.sub,
      isActive: getBooleanValue(payload, "isActive"),
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    return NextResponse.json({ account });
  } catch (error) {
    return handleRouteError(error);
  }
}
