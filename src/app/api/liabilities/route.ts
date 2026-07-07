import { LiabilityType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getBooleanValue,
  getDateValue,
  getDecimalValue,
  getEnumValue,
  getNullableStringValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { createLiabilityRepository } from "@/modules/liabilities";

const liabilityRepository = createLiabilityRepository();

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const liabilities = await liabilityRepository.listByUser(session.sub);
  return NextResponse.json({ liabilities });
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

    const liability = await liabilityRepository.create({
      userId: session.sub,
      name: getStringValue(payload, "name"),
      liabilityType: getEnumValue(payload, "liabilityType", Object.values(LiabilityType)),
      currency: getStringValue(payload, "currency"),
      originalAmount: getDecimalValue(payload, "originalAmount"),
      currentBalance: getDecimalValue(payload, "currentBalance"),
      interestRate: getDecimalValue(payload, "interestRate"),
      monthlyPayment: getDecimalValue(payload, "monthlyPayment"),
      startDate: getDateValue(payload, "startDate"),
      endDate:
        getStringValue(payload, "endDate", { optional: true }) === null
          ? null
          : getDateValue(payload, "endDate"),
      paymentAccountId: getStringValue(payload, "paymentAccountId", { optional: true }),
      isActive: getBooleanValue(payload, "isActive"),
      notes: getNullableStringValue(payload, "notes"),
    });

    return NextResponse.json({ liability }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
