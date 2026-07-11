import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const schemaPath = process.env.PRISMA_SCHEMA_PATH?.trim();

if (args.length === 0) {
  console.error("Usage: node scripts/run-prisma-command.mjs <prisma args...>");
  process.exit(1);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const prismaArgs = ["prisma", ...args];

if (schemaPath) {
  prismaArgs.push("--schema", schemaPath);
}

const result = spawnSync(command, prismaArgs, {
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
