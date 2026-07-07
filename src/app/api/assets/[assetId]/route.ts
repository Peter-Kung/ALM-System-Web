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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const { assetId } = await params;
    const existingAsset = await assetRepository.findById(assetId);

    if (!existingAsset || existingAsset.userId !== session.sub) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const asset = await assetRepository.update(assetId, {
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

    return NextResponse.json({ asset });
  } catch (error) {
    return handleRouteError(error);
  }
}
