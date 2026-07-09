export type IssueReportResult = {
  issueNumber: number;
  issueUrl: string;
};

export type SubmitIssueReportInput = {
  title: string;
  description: string;
  pagePath: string;
  username: string;
  token: string;
};

export type GitHubIssueReporter = {
  createIssue(input: {
    repositoryFullName: string;
    title: string;
    body: string;
    token: string;
  }): Promise<IssueReportResult>;
};

export async function submitIssueReport(
  input: SubmitIssueReportInput & { repositoryFullName: string },
  reporter: GitHubIssueReporter,
) {
  return reporter.createIssue({
    repositoryFullName: input.repositoryFullName,
    title: input.title,
    body: buildIssueBody(input),
    token: input.token,
  });
}

export function buildIssueBody(input: Omit<SubmitIssueReportInput, "token">) {
  return `${input.description}

---
Current page: ${input.pagePath}
Reported by: ${input.username}`;
}

export function createGitHubIssueReporter(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 10_000,
): GitHubIssueReporter {
  return {
    async createIssue({ repositoryFullName, title, body, token }) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      let response: Response;

      try {
        response = await fetchImpl(
          `https://api.github.com/repos/${repositoryFullName}/issues`,
          {
            method: "POST",
            headers: {
              accept: "application/vnd.github+json",
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
              "user-agent": "alm-system-web",
            },
            body: JSON.stringify({ title, body }),
            signal: controller.signal,
          },
        );
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("GitHub issue creation timed out.");
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`GitHub issue creation failed with status ${response.status}.`);
      }

      const payload = (await response.json()) as {
        number: number;
        html_url: string;
      };

      return {
        issueNumber: payload.number,
        issueUrl: payload.html_url,
      };
    },
  };
}
