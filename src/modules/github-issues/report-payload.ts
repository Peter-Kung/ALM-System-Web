import { RepositoryValidationError } from "@/lib/repository-utils";

export type IssueReportPayload = {
  title: string;
  description: string;
  pagePath: string;
};

export function parseIssueReportPayload(payload: unknown): IssueReportPayload {
  if (!payload || typeof payload !== "object") {
    throw new RepositoryValidationError("Issue report payload must be an object.");
  }

  const title = readRequiredString(payload, "title");
  const description = readRequiredString(payload, "description");
  const pagePath = readRequiredString(payload, "pagePath");

  return {
    title,
    description,
    pagePath: pagePath.startsWith("/") ? pagePath : `/${pagePath}`,
  };
}

function readRequiredString(payload: object, fieldName: string) {
  const value = Reflect.get(payload, fieldName);

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RepositoryValidationError(`${fieldName} is required.`);
  }

  return value.trim();
}
