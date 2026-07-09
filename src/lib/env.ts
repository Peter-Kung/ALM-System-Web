const defaultDatabaseUrl = "file:./dev.db";
const isDevelopment = process.env.NODE_ENV !== "production";
const githubRepositoryPattern = /^[^/\s]+\/[^/\s]+$/;

function getOptionalSecret(name: string, developmentFallback?: string) {
  const value = normalizeOptionalConfigValue(process.env[name]);
  if (value) {
    return value;
  }

  if (isDevelopment && developmentFallback) {
    return developmentFallback;
  }

  return null;
}

function getOptionalRepository(name: string) {
  const value = normalizeOptionalConfigValue(process.env[name]);

  if (!value || !githubRepositoryPattern.test(value)) {
    return null;
  }

  return value;
}

function normalizeOptionalConfigValue(value: string | undefined) {
  const normalizedValue = value?.trim();

  return normalizedValue ? normalizedValue : null;
}

export const env = {
  appName: process.env.APP_NAME ?? "ALM System",
  fixedUsername: process.env.APP_USERNAME ?? "owner",
  fixedPassword: getOptionalSecret("APP_PASSWORD", "change-me"),
  githubIssueRepository: getOptionalRepository("GITHUB_ISSUE_REPOSITORY"),
  githubIssueToken:
    normalizeOptionalConfigValue(process.env.GITHUB_TOKEN) ??
    normalizeOptionalConfigValue(process.env.GH_TOKEN),
  sessionSecret: getOptionalSecret(
    "SESSION_SECRET",
    "development-session-secret-change-me",
  ),
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl,
};

function requireConfiguredValue(value: string | null, envName: string) {
  if (!value) {
    throw new Error(`${envName} must be set outside local development.`);
  }

  return value;
}

export function requireFixedPassword() {
  return requireConfiguredValue(env.fixedPassword, "APP_PASSWORD");
}

export function requireSessionSecret() {
  return requireConfiguredValue(env.sessionSecret, "SESSION_SECRET");
}
