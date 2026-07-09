import { NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { env } from "@/lib/env";
import { RepositoryValidationError } from "@/lib/repository-utils";
import { parseIssueReportPayload } from "@/modules/github-issues/report-payload";
import {
  createGitHubIssueReporter,
  submitIssueReport,
} from "@/modules/github-issues/service";

export async function POST(request: NextRequest) {
  const { response, session } = await requireApiSession();
  if (response || !session) {
    return response;
  }

  if (!env.githubIssueToken || !env.githubIssueRepository) {
    return NextResponse.json({ error: "Issue reporting is not configured." }, { status: 500 });
  }

  try {
    const payload = parseIssueReportPayload(await request.json().catch(() => null));
    const result = await submitIssueReport(
      {
        ...payload,
        repositoryFullName: env.githubIssueRepository,
        username: session.username,
        token: env.githubIssueToken,
      },
      createGitHubIssueReporter(),
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json({ error: "Unable to create issue report." }, { status: 500 });
  }
}
