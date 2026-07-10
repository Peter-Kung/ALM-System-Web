import { AssetPriceSourceType, AssetType } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

import {
  getBooleanValue,
  getEnumValue,
  getNullableStringValue,
  getStringValue,
  handleRouteError,
  readJsonBody,
} from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { createAssetRepository, type AssetRepository } from "@/modules/assets";

type RequireApiSession = typeof requireApiSession;

export type AssetRouteHandlerDependencies = {
  createRepository: () => AssetRepository;
  requireSession: RequireApiSession;
};

export const defaultAssetRouteHandlerDependencies: AssetRouteHandlerDependencies = {
  createRepository: createAssetRepository,
  requireSession: requireApiSession,
};

export async function listAssetsHandler(
  dependencies: AssetRouteHandlerDependencies = defaultAssetRouteHandlerDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  const assets = await dependencies.createRepository().listByUser(session.sub);
  return NextResponse.json({ assets });
}

export async function createAssetHandler(
  request: NextRequest,
  dependencies: AssetRouteHandlerDependencies = defaultAssetRouteHandlerDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  try {
    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const asset = await dependencies.createRepository().create({
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

export async function updateAssetHandler(
  request: NextRequest,
  params: { assetId: string },
  dependencies: AssetRouteHandlerDependencies = defaultAssetRouteHandlerDependencies,
) {
  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return response;
  }

  try {
    const repository = dependencies.createRepository();
    const existingAsset = await repository.findById(params.assetId);

    if (!existingAsset || existingAsset.userId !== session.sub) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 });
    }

    const payload = await readJsonBody(request);
    if (!payload) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const asset = await repository.update(params.assetId, {
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
