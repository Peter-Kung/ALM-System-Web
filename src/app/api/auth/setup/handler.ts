import { NextRequest, NextResponse } from "next/server";

export async function setupHandler(
  request: NextRequest,
) {
  void request;
  return NextResponse.json(
    {
      error:
        "Interactive setup is disabled. Sign in with APP_USERNAME and APP_PASSWORD at /login.",
    },
    { status: 410 },
  );
}
