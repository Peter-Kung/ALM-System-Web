import { AssetPriceSourceType, PriceRecordSourceType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  getBooleanValue,
  getDecimalValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { createAssetRepository } from "@/modules/assets";
import { createPriceRecordRepository } from "@/modules/prices";

const assetRepository = createAssetRepository();
const priceRecordRepository = createPriceRecordRepository();

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const latestRecords = await priceRecordRepository.listLatestByUser(session.sub);
  const latestByAssetId = new Map<string, (typeof latestRecords)[number]>();

  for (const record of latestRecords) {
    if (!latestByAssetId.has(record.assetId)) {
      latestByAssetId.set(record.assetId, record);
    }
  }

  return NextResponse.json({ priceRecords: [...latestByAssetId.values()] });
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

    const assetId = getStringValue(payload, "assetId");
    const asset = await assetRepository.findById(assetId);

    if (!asset || asset.userId !== session.sub) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    if (!asset.isActive) {
      return NextResponse.json(
        { error: "Manual price entry is limited to active assets." },
        { status: 400 },
      );
    }

    if (asset.priceSourceType !== AssetPriceSourceType.MANUAL) {
      return NextResponse.json(
        { error: "Manual price entry is only allowed for manual-priced assets." },
        { status: 400 },
      );
    }

    const priceRecord = await priceRecordRepository.create(
      {
        assetId,
        sourceType: PriceRecordSourceType.MANUAL_ENTRY,
        currency: getStringValue(payload, "currency"),
        price: getDecimalValue(payload, "price"),
        recordedAt: new Date(),
        isValid: getBooleanValue(payload, "isValid"),
      },
      session.sub,
    );

    return NextResponse.json({ priceRecord }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
