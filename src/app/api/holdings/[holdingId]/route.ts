import { NextRequest, NextResponse } from "next/server";

import {
  getBooleanValue,
  getDecimalValue,
  getNullableStringValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { createHoldingRepository } from "@/modules/holdings";

const holdingRepository = createHoldingRepository();

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ holdingId: string }> },
) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const { holdingId } = await params;
    const existingHolding = await holdingRepository.findById(holdingId);

    if (
      !existingHolding ||
      existingHolding.account.userId !== session.sub ||
      existingHolding.asset.userId !== session.sub
    ) {
      return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    }

    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const holding = await holdingRepository.update(holdingId, {
      accountId: getStringValue(payload, "accountId"),
      assetId: getStringValue(payload, "assetId"),
      quantity: getDecimalValue(payload, "quantity"),
      isActive: getBooleanValue(payload, "isActive"),
      notes: getNullableStringValue(payload, "notes"),
    }, session.sub);

    return NextResponse.json({ holding });
  } catch (error) {
    return handleRouteError(error);
  }
}
