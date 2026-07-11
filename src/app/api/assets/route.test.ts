import assert from "node:assert/strict";
import test from "node:test";

import { AssetPriceSourceType, AssetType, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import {
  createAssetHandler,
  updateAssetHandler,
  type AssetRouteHandlerDependencies,
} from "./handler";

function createJsonRequest(body: Record<string, unknown>) {
  return new NextRequest("https://example.test/api/assets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createAssetFixture() {
  const existingAsset = {
    id: "asset-1",
    userId: "user-1",
    name: "Existing fund",
    assetType: AssetType.FUND,
    symbol: null,
    currency: "TWD",
    priceSourceType: AssetPriceSourceType.MANUAL,
    isActive: true,
    notes: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    holdings: [],
    priceRecords: [],
  };
  const createdAssets: Prisma.AssetUncheckedCreateInput[] = [];
  const updatedAssets: Prisma.AssetUncheckedUpdateInput[] = [];

  const dependencies: AssetRouteHandlerDependencies = {
    async requireSession() {
      return {
        response: null,
        session: {
          sub: "user-1",
          username: "owner",
          role: "ADMIN",
          sessionVersion: 0,
        },
      };
    },
    createRepository() {
      return {
        async create(data: Prisma.AssetUncheckedCreateInput) {
          createdAssets.push(data);
          return {
            id: "asset-2",
            userId: data.userId,
            name: data.name,
            assetType: data.assetType,
            symbol: typeof data.symbol === "string" ? data.symbol : null,
            currency: data.currency,
            priceSourceType: data.priceSourceType,
            isActive: data.isActive ?? true,
            notes: typeof data.notes === "string" ? data.notes : null,
            createdAt: existingAsset.createdAt,
            updatedAt: existingAsset.updatedAt,
          };
        },
        async findById(id: string) {
          return id === existingAsset.id ? existingAsset : null;
        },
        async listByUser() {
          return [existingAsset];
        },
        async update(id: string, data: Prisma.AssetUncheckedUpdateInput) {
          updatedAssets.push(data);
          return {
            ...existingAsset,
            id,
            name: typeof data.name === "string" ? data.name : existingAsset.name,
            assetType:
              typeof data.assetType === "string"
                ? data.assetType
                : existingAsset.assetType,
            symbol: typeof data.symbol === "string" ? data.symbol : existingAsset.symbol,
            currency:
              typeof data.currency === "string" ? data.currency : existingAsset.currency,
            priceSourceType:
              typeof data.priceSourceType === "string"
                ? data.priceSourceType
                : existingAsset.priceSourceType,
            isActive:
              typeof data.isActive === "boolean" ? data.isActive : existingAsset.isActive,
            notes: typeof data.notes === "string" ? data.notes : existingAsset.notes,
          };
        },
      };
    },
  };

  return { createdAssets, dependencies, updatedAssets };
}

test("createAssetHandler accepts real estate asset type", async () => {
  const { createdAssets, dependencies } = createAssetFixture();

  const response = await createAssetHandler(
    createJsonRequest({
      name: "Home",
      assetType: AssetType.REAL_ESTATE,
      symbol: null,
      currency: "TWD",
      priceSourceType: AssetPriceSourceType.MANUAL,
      isActive: true,
      notes: null,
    }),
    dependencies,
  );

  assert.equal(response.status, 201);
  assert.equal(createdAssets[0]?.assetType, AssetType.REAL_ESTATE);
  const payload = (await response.json()) as { asset: { assetType?: string } };
  assert.equal(payload.asset.assetType, AssetType.REAL_ESTATE);
});

test("updateAssetHandler accepts real estate asset type", async () => {
  const { dependencies, updatedAssets } = createAssetFixture();

  const response = await updateAssetHandler(
    createJsonRequest({
      name: "Home",
      assetType: AssetType.REAL_ESTATE,
      symbol: null,
      currency: "TWD",
      priceSourceType: AssetPriceSourceType.MANUAL,
      isActive: true,
      notes: null,
    }),
    { assetId: "asset-1" },
    dependencies,
  );

  assert.equal(response.status, 200);
  assert.equal(updatedAssets[0]?.assetType, AssetType.REAL_ESTATE);
});

test("updateAssetHandler hides another user's asset id", async () => {
  const { dependencies, updatedAssets } = createAssetFixture();

  const response = await updateAssetHandler(
    createJsonRequest({
      name: "Other user's home",
      assetType: AssetType.REAL_ESTATE,
      symbol: null,
      currency: "TWD",
      priceSourceType: AssetPriceSourceType.MANUAL,
      isActive: true,
      notes: null,
    }),
    { assetId: "asset-owned-by-user-2" },
    {
      ...dependencies,
      createRepository() {
        const repository = dependencies.createRepository();

        return {
          ...repository,
          async findById(id: string) {
            if (id === "asset-owned-by-user-2") {
              return {
                id,
                userId: "user-2",
                name: "Private home",
                assetType: AssetType.REAL_ESTATE,
                symbol: null,
                currency: "TWD",
                priceSourceType: AssetPriceSourceType.MANUAL,
                isActive: true,
                notes: null,
                createdAt: new Date("2026-07-01T00:00:00Z"),
                updatedAt: new Date("2026-07-01T00:00:00Z"),
                holdings: [],
                priceRecords: [],
              };
            }

            return repository.findById(id);
          },
        };
      },
    },
  );

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Asset not found." });
  assert.deepEqual(updatedAssets, []);
});

test("createAssetHandler keeps rejecting unsupported asset types", async () => {
  const { createdAssets, dependencies } = createAssetFixture();

  const response = await createAssetHandler(
    createJsonRequest({
      name: "Home",
      assetType: "PROPERTY",
      symbol: null,
      currency: "TWD",
      priceSourceType: AssetPriceSourceType.MANUAL,
      isActive: true,
      notes: null,
    }),
    dependencies,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error:
      "assetType must be one of: STOCK, ETF, FUND, CASH_EQUIVALENT, REAL_ESTATE, OTHER.",
  });
  assert.deepEqual(createdAssets, []);
});

test("updateAssetHandler keeps rejecting unsupported asset types", async () => {
  const { dependencies, updatedAssets } = createAssetFixture();

  const response = await updateAssetHandler(
    createJsonRequest({
      name: "Home",
      assetType: "PROPERTY",
      symbol: null,
      currency: "TWD",
      priceSourceType: AssetPriceSourceType.MANUAL,
      isActive: true,
      notes: null,
    }),
    { assetId: "asset-1" },
    dependencies,
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error:
      "assetType must be one of: STOCK, ETF, FUND, CASH_EQUIVALENT, REAL_ESTATE, OTHER.",
  });
  assert.deepEqual(updatedAssets, []);
});
