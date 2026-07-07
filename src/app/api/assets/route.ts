import { AssetPriceSourceType, AssetType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getBooleanValue,
  getEnumValue,
  getNullableStringValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { createAssetRepository } from "@/modules/assets";

const assetRepository = createAssetRepository();

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const assets = await assetRepository.listByUser(session.sub);
  return NextResponse.json({ assets });
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

    const asset = await assetRepository.create({
      userId: session.sub,
      name: getStringValue(payload, "name"),
      assetType: getEnumValue(payload, "assetType", Object.values(AssetType)),
      symbol: getNullableStringValue(payload, "symbol"),
      currency: getStringValue(payload, "currency"),
      priceSourceType: getEnumValue(
        payload,
        "priceSourceType",
        Object.values(AssetPriceSourceType),
      ),
      isActive: getBooleanValue(payload, "isActive"),
      notes: getNullableStringValue(payload, "notes"),
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
