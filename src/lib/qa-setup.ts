import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const QA_USERNAME = "qa-owner";
const DEV_DATABASE_URL = "file:./dev.db";

type QaSetupLogger = {
  info(message: string): void;
};

type QaSetupCommandRunner = (
  command: string,
  args: string[],
  cwd: string,
  envOverrides: Partial<NodeJS.ProcessEnv>,
) => void;

type QaSetupDependencies = {
  cwd: string;
  generateSecret?: (bytes: number) => string;
  logger?: QaSetupLogger;
  readEnvFile?: (filePath: string) => Promise<string>;
  runCommand: QaSetupCommandRunner;
  writeEnvFile?: (filePath: string, content: string) => Promise<void>;
};

function createDefaultSecret(bytes: number) {
  return randomBytes(bytes).toString("base64url");
}

export function buildQaEnvFile(password: string, sessionSecret: string) {
  return [
    `DATABASE_URL="${DEV_DATABASE_URL}"`,
    `APP_USERNAME=${QA_USERNAME}`,
    `APP_PASSWORD=${password}`,
    `APP_ADMIN_USERNAME=${QA_USERNAME}`,
    `APP_ADMIN_PASSWORD=${password}`,
    `SESSION_SECRET=${sessionSecret}`,
    "",
  ].join("\n");
}

export function readEnvValue(content: string, key: string) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) {
    return null;
  }

  return match[1].trim().replace(/^['"]|['"]$/g, "") || null;
}

export async function runQaSetup({
  cwd,
  generateSecret = createDefaultSecret,
  logger = console,
  readEnvFile = (filePath) => readFile(filePath, "utf8"),
  runCommand,
  writeEnvFile = (filePath, content) => writeFile(filePath, content, "utf8"),
}: QaSetupDependencies) {
  const envPath = path.join(cwd, ".env");
  let createdEnv = false;
  let databaseUrl = DEV_DATABASE_URL;

  try {
    const existingEnv = await readEnvFile(envPath);
    const username = readEnvValue(existingEnv, "APP_USERNAME");
    databaseUrl = readEnvValue(existingEnv, "DATABASE_URL") ?? DEV_DATABASE_URL;

    logger.info(`Found existing .env at ${envPath}.`);
    if (username) {
      logger.info(`Using existing APP_USERNAME=${username}.`);
    } else {
      logger.info("Existing .env does not define APP_USERNAME.");
    }
    logger.info("Read APP_PASSWORD from .env if you need it.");
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }

    createdEnv = true;
    const password = generateSecret(24);
    const sessionSecret = generateSecret(32);
    await writeEnvFile(envPath, buildQaEnvFile(password, sessionSecret));

    logger.info(`Created ${envPath}.`);
    logger.info(`APP_USERNAME=${QA_USERNAME}`);
    logger.info(`APP_PASSWORD=${password}`);
    logger.info("This password is printed only for the first setup. Keep it in your local .env.");
  }

  logger.info("Running Prisma Client generation...");
  runCommand("npm", ["run", "db:generate"], cwd, {
    DATABASE_URL: databaseUrl,
  });
  logger.info("Running local Prisma migrations...");
  runCommand("npm", ["run", "db:migrate"], cwd, {
    DATABASE_URL: databaseUrl,
  });
  logger.info("QA setup is ready. Start the app with: npm run dev");

  return { createdEnv, envPath };
}
