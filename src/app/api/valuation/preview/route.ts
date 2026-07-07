import { NextRequest, NextResponse } from "next/server";

import { readJsonBody } from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  createValuationContextForUser,
  createValuationPreviewForUser,
} from "@/modules/valuation";

function readFxRates(payload: Record<string, unknown> | null) {
  if (!payload || payload.fxRates == null) {
    return undefined;
  }

  if (
    typeof payload.fxRates !== "object" ||
    Array.isArray(payload.fxRates) ||
    payload.fxRates === null
  ) {
    throw new RepositoryValidationError("fxRates must be an object keyed by currency.");
  }

  const fxRates: Record<string, string | number> = {};

  for (const [currency, rawValue] of Object.entries(payload.fxRates)) {
    if (typeof rawValue !== "string" && typeof rawValue !== "number") {
      throw new RepositoryValidationError(
        `fxRates.${currency} must be a string or number.`,
      );
    }

    fxRates[currency] = rawValue;
  }

  return fxRates;
}

export async function POST(request: NextRequest) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const payload = await readJsonBody(request);
    const preview = await createValuationPreviewForUser(
      session.sub,
      readFxRates(payload),
    );

    return NextResponse.json(preview);
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const context = await createValuationContextForUser(session.sub);
    return NextResponse.json(context);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
