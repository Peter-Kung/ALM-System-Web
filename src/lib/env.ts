import { runtimePaths } from "@/lib/runtime-paths";

const isDevelopment = process.env.NODE_ENV !== "production";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = runtimePaths.databaseUrl;
}

function getOptionalSecret(name: string, developmentFallback?: string) {
  const value = process.env[name];
  if (value) {
    return value;
  }

  if (isDevelopment && developmentFallback) {
    return developmentFallback;
  }

  return null;
}

function normalizeFixedUsername(value: string | undefined) {
  const username = (value ?? "owner").trim();
  if (!username) {
    throw new Error("APP_USERNAME must not be empty.");
  }

  if (username.length < 3 || username.length > 32 || !/^[A-Za-z0-9._-]+$/.test(username)) {
    throw new Error(
      "APP_USERNAME must be 3 to 32 characters and use only letters, numbers, '.', '_', and '-'.",
    );
  }

  return username;
}

export const env = {
  appName: process.env.APP_NAME ?? "ALM System",
  fixedUsername: normalizeFixedUsername(process.env.APP_USERNAME),
  fixedPassword: getOptionalSecret("APP_PASSWORD", "change-me"),
  sessionSecret: getOptionalSecret(
    "SESSION_SECRET",
    "development-session-secret-change-me",
  ),
  databaseUrl: runtimePaths.databaseUrl,
  runtimePaths,
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
