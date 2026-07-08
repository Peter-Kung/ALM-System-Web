import { NextRequest, NextResponse } from "next/server";

import { getStringValue, handleRouteError, readJsonBody } from "@/lib/api-route";
import { requireApiSession } from "@/lib/auth/api";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  confirmSnapshotFromPreviewInput,
  createSnapshotRepository,
  readSnapshotPreviewToken,
} from "@/modules/snapshots";

const snapshotRepository = createSnapshotRepository();

function readConfirmationToken(payload: Record<string, unknown> | null) {
  if (!payload) {
    throw new RepositoryValidationError("Invalid JSON body.");
  }

  return getStringValue(payload, "confirmationToken");
}

export async function GET() {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const snapshots = await snapshotRepository.listByUser(session.sub);

  return NextResponse.json({
    snapshots: snapshots.map((snapshot) => ({
      id: snapshot.id,
      status: snapshot.status,
      baseCurrency: snapshot.baseCurrency,
      totalAssets: snapshot.totalAssets,
      totalLiabilities: snapshot.totalLiabilities,
      netWorth: snapshot.netWorth,
      cashPosition: snapshot.cashPosition,
      investmentValue: snapshot.investmentValue,
      monthlyDebtPaymentTotal: snapshot.monthlyDebtPaymentTotal,
      snapshotAt: snapshot.snapshotAt,
      createdAt: snapshot.createdAt,
      accountCount: snapshot.accounts.length,
      holdingCount: snapshot.holdings.length,
      liabilityCount: snapshot.liabilities.length,
      issueCount: snapshot.issues.length,
    })),
  });
}

export async function POST(request: NextRequest) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  try {
    const payload = await readJsonBody(request);
    const token = await readSnapshotPreviewToken(readConfirmationToken(payload));

    if (!token || token.sub !== session.sub) {
      return NextResponse.json(
        { error: "Snapshot confirmation token is invalid or expired." },
        { status: 400 },
      );
    }

    const snapshot = await confirmSnapshotFromPreviewInput(
      session.sub,
      token.previewInput,
    );

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
