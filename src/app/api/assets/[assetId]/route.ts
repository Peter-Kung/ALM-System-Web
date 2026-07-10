import { type NextRequest } from "next/server";

import { updateAssetHandler } from "../handler";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  return updateAssetHandler(request, await params);
}
