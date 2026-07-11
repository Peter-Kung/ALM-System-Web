import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { runQaSetup } from "../src/lib/qa-setup";

function getNpmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function main() {
  await runQaSetup({
    cwd: process.cwd(),
    generateSecret(bytes) {
      return randomBytes(bytes).toString("base64url");
    },
    runCommand(_command, args, cwd, envOverrides) {
      const result = spawnSync(getNpmCommand(), args, {
        cwd,
        env: {
          ...process.env,
          ...envOverrides,
        },
        stdio: "inherit",
      });

      if (result.error) {
        throw result.error;
      }

      if (result.status !== 0) {
        process.exit(result.status ?? 1);
      }
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
