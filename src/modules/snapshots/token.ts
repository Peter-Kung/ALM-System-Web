import { jwtVerify, SignJWT } from "jose";

import { requireSessionSecret } from "@/lib/env";
import type { ValuationPreviewInput } from "@/modules/valuation/types";

const encoder = new TextEncoder();

type SnapshotPreviewTokenClaims = {
  kind: "snapshot-preview";
  previewInput: ValuationPreviewInput;
};

function getSecret() {
  return encoder.encode(requireSessionSecret());
}

export async function createSnapshotPreviewToken(
  userId: string,
  previewInput: ValuationPreviewInput,
) {
  return new SignJWT({
    kind: "snapshot-preview",
    previewInput,
  } satisfies SnapshotPreviewTokenClaims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());
}

export async function readSnapshotPreviewToken(token: string) {
  try {
    const verified = await jwtVerify(token, getSecret());

    if (
      verified.payload.sub == null ||
      typeof verified.payload.sub !== "string" ||
      verified.payload.kind !== "snapshot-preview" ||
      typeof verified.payload.previewInput !== "object" ||
      verified.payload.previewInput === null
    ) {
      return null;
    }

    return {
      sub: verified.payload.sub,
      previewInput: verified.payload.previewInput as ValuationPreviewInput,
    };
  } catch {
    return null;
  }
}
