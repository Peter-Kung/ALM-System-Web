import { type NextRequest } from "next/server";

import { createAssetHandler, listAssetsHandler } from "./handler";

export async function GET() {
  return listAssetsHandler();
}

export async function POST(request: NextRequest) {
  return createAssetHandler(request);
}
