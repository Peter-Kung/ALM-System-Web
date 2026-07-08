import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { createSnapshotRepository } from "@/modules/snapshots";

const snapshotRepository = createSnapshotRepository();

export async function GET(
  _request: Request,
  context: { params: Promise<{ snapshotId: string }> },
) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  const { snapshotId } = await context.params;
  const snapshot = await snapshotRepository.findById(snapshotId);

  if (!snapshot || snapshot.userId !== session.sub) {
    return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  }

  return NextResponse.json({ snapshot });
}
