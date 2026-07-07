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

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const holdings = await holdingRepository.listByUser(session.sub);
  return NextResponse.json({ holdings });
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

    const holding = await holdingRepository.create({
      accountId: getStringValue(payload, "accountId"),
      assetId: getStringValue(payload, "assetId"),
      quantity: getDecimalValue(payload, "quantity"),
      isActive: getBooleanValue(payload, "isActive"),
      notes: getNullableStringValue(payload, "notes"),
    }, session.sub);

    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
