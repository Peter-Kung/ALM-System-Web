import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIssueBody,
  createGitHubIssueReporter,
  submitIssueReport,
} from "@/modules/github-issues/service";

test("submitIssueReport sends the title and generated body to the reporter", async () => {
  const calls: Array<{
    repositoryFullName: string;
    title: string;
    body: string;
    token: string;
  }> = [];

  const result = await submitIssueReport(
    {
      repositoryFullName: "Peter-Kung/ALM-System-Web",
      title: "Need better sidebar feedback",
      description: "The footer action should stay inside the app shell.",
      pagePath: "/manage/assets",
      username: "owner",
      token: "secret-token",
    },
    {
      async createIssue(input) {
        calls.push(input);
        return {
          issueNumber: 57,
          issueUrl: "https://github.com/Peter-Kung/ALM-System-Web/issues/57",
        };
      },
    },
  );

  assert.deepEqual(result, {
    issueNumber: 57,
    issueUrl: "https://github.com/Peter-Kung/ALM-System-Web/issues/57",
  });
  assert.deepEqual(calls, [
    {
      repositoryFullName: "Peter-Kung/ALM-System-Web",
      title: "Need better sidebar feedback",
      body: buildIssueBody({
        title: "Need better sidebar feedback",
        description: "The footer action should stay inside the app shell.",
        pagePath: "/manage/assets",
        username: "owner",
      }),
      token: "secret-token",
    },
  ]);
});

test("createGitHubIssueReporter posts to the fixed repository and returns issue metadata", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  const reporter = createGitHubIssueReporter(async (url, init) => {
    requests.push({ url: String(url), init });

    return new Response(
      JSON.stringify({
        number: 61,
        html_url: "https://github.com/Peter-Kung/ALM-System-Web/issues/61",
      }),
      { status: 201 },
    );
  });

  const result = await reporter.createIssue({
    repositoryFullName: "Peter-Kung/ALM-System-Web",
    title: "Open shell report modal from footer",
    body: "Body text",
    token: "secret-token",
  });

  assert.deepEqual(result, {
    issueNumber: 61,
    issueUrl: "https://github.com/Peter-Kung/ALM-System-Web/issues/61",
  });
  assert.equal(
    requests[0]?.url,
    "https://api.github.com/repos/Peter-Kung/ALM-System-Web/issues",
  );
  assert.equal(
    requests[0]?.init?.headers &&
      (requests[0].init.headers as Record<string, string>).authorization,
    "Bearer secret-token",
  );
});

test("createGitHubIssueReporter fails with a controlled timeout error", async () => {
  const reporter = createGitHubIssueReporter(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      }),
    5,
  );

  await assert.rejects(
    () =>
      reporter.createIssue({
        repositoryFullName: "Peter-Kung/ALM-System-Web",
        title: "Open shell report modal from footer",
        body: "Body text",
        token: "secret-token",
      }),
    (error: unknown) =>
      error instanceof Error && error.message === "GitHub issue creation timed out.",
  );
});
