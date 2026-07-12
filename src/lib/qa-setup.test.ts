import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildQaEnvFile, runQaSetup } from "@/lib/qa-setup";

const DEV_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/alm_system_web?schema=public";

test("runQaSetup creates a new .env, prints credentials once, and runs Prisma setup", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "qa-setup-new-"));
  const logs: string[] = [];
  const commands: Array<{
    command: string;
    args: string[];
    cwd: string;
    envOverrides: Partial<NodeJS.ProcessEnv>;
  }> = [];
  const secrets = ["generated-password", "generated-session-secret"];

  await runQaSetup({
    cwd,
    generateSecret: () => {
      const secret = secrets.shift();
      assert.ok(secret);
      return secret;
    },
    logger: {
      info(message) {
        logs.push(message);
      },
    },
    runCommand(command, args, commandCwd, envOverrides) {
      commands.push({ command, args, cwd: commandCwd, envOverrides });
    },
  });

  const envContent = await readFile(path.join(cwd, ".env"), "utf8");
  assert.equal(
    envContent,
    buildQaEnvFile("generated-password", "generated-session-secret"),
  );
  assert.deepEqual(commands, [
    {
      command: "npm",
      args: ["run", "db:generate"],
      cwd,
      envOverrides: { DATABASE_URL: DEV_DATABASE_URL },
    },
    {
      command: "npm",
      args: ["run", "db:migrate"],
      cwd,
      envOverrides: { DATABASE_URL: DEV_DATABASE_URL },
    },
  ]);
  assert.match(logs.join("\n"), /APP_USERNAME=qa-owner/);
  assert.match(logs.join("\n"), /APP_PASSWORD=generated-password/);
  assert.match(logs.join("\n"), /npm run dev/);
});

test("runQaSetup preserves an existing .env and does not print the password", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "qa-setup-existing-"));
  const envPath = path.join(cwd, ".env");
  const logs: string[] = [];
  const commands: Array<{
    command: string;
    args: string[];
    cwd: string;
    envOverrides: Partial<NodeJS.ProcessEnv>;
  }> = [];
  const existingEnv = [
    'DATABASE_URL="postgresql://db.internal:5432/existing_alm?schema=public"',
    "APP_USERNAME=existing-owner",
    "APP_PASSWORD=do-not-print-me",
    "SESSION_SECRET=existing-session-secret",
    "",
  ].join("\n");

  await writeFile(envPath, existingEnv, "utf8");

  await runQaSetup({
    cwd,
    logger: {
      info(message) {
        logs.push(message);
      },
    },
    runCommand(command, args, commandCwd, envOverrides) {
      commands.push({ command, args, cwd: commandCwd, envOverrides });
    },
  });

  assert.equal(await readFile(envPath, "utf8"), existingEnv);
  assert.deepEqual(commands, [
    {
      command: "npm",
      args: ["run", "db:generate"],
      cwd,
      envOverrides: { DATABASE_URL: "postgresql://db.internal:5432/existing_alm?schema=public" },
    },
    {
      command: "npm",
      args: ["run", "db:migrate"],
      cwd,
      envOverrides: { DATABASE_URL: "postgresql://db.internal:5432/existing_alm?schema=public" },
    },
  ]);
  assert.match(logs.join("\n"), /Using existing APP_USERNAME=existing-owner/);
  assert.match(logs.join("\n"), /Read APP_PASSWORD from \.env if you need it/);
  assert.doesNotMatch(logs.join("\n"), /do-not-print-me/);
});
