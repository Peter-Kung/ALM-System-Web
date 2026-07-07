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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ liabilityId: string }> },
) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const { liabilityId } = await params;
    const existingLiability = await liabilityRepository.findById(liabilityId);

    if (!existingLiability || existingLiability.userId !== session.sub) {
      return NextResponse.json({ error: "Liability not found." }, { status: 404 });
    }

    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const liability = await liabilityRepository.update(
      liabilityId,
      {
        name: getStringValue(payload, "name"),
        liabilityType: getEnumValue(
          payload,
          "liabilityType",
          Object.values(LiabilityType),
        ),
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
      },
      session.sub,
    );

    return NextResponse.json({ liability });
  } catch (error) {
    return handleRouteError(error);
  }
}
