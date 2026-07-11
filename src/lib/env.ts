const defaultDatabaseUrl = "file:./dev.db";
const isDevelopment = process.env.NODE_ENV !== "production";

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

export const env = {
  appName: process.env.APP_NAME ?? "ALM System",
  fixedUsername: process.env.APP_USERNAME ?? "owner",
  fixedPassword: getOptionalSecret("APP_PASSWORD", "change-me"),
  setupToken: getOptionalSecret("APP_SETUP_TOKEN", "setup-token"),
  sessionSecret: getOptionalSecret(
    "SESSION_SECRET",
    "development-session-secret-change-me",
  ),
  databaseUrl: process.env.DATABASE_URL ?? defaultDatabaseUrl,
};

export function getConfiguredAdminCredentials() {
  const username = process.env.APP_ADMIN_USERNAME?.trim();
  const password = process.env.APP_ADMIN_PASSWORD;

  if (!username && !password) {
    return null;
  }

  if (!username || !password) {
    throw new Error(
      "APP_ADMIN_USERNAME and APP_ADMIN_PASSWORD must be configured together.",
    );
  }

  return { username, password };
}

function requireConfiguredValue(value: string | null, envName: string) {
  if (!value) {
    throw new Error(`${envName} must be set outside local development.`);
  }

  return value;
}

export function requireFixedPassword() {
  return requireConfiguredValue(env.fixedPassword, "APP_PASSWORD");
}

export function requireSetupToken() {
  return requireConfiguredValue(env.setupToken, "APP_SETUP_TOKEN");
}

export function requireSessionSecret() {
  return requireConfiguredValue(env.sessionSecret, "SESSION_SECRET");
}
