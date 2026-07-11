import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  checkDeploymentState,
  getDeploymentState,
  startDeploymentOperation,
} from "@/modules/deployment/service";

test("getDeploymentState reports current image, target image, and persisted update result", async () => {
  const updateStateDir = await mkdtemp(path.join(os.tmpdir(), "alm-deploy-state-"));
  await writeFile(
    path.join(updateStateDir, "last-update.json"),
    JSON.stringify({
      status: "rolled_back",
      fromImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
      targetImage: "ghcr.io/peter-kung/alm-system-web:sha-new",
      activeImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
      backupPath: "/opt/alm-system/backups/alm-system.db",
      message: "Update validation failed.",
      updatedAt: "2026-07-11T09:00:00Z",
    }),
  );

  const state = await getDeploymentState({
    environment: {
      ALM_IMAGE: "ghcr.io/peter-kung/alm-system-web:sha-old",
      ALM_UPDATE_TARGET_IMAGE: "ghcr.io/peter-kung/alm-system-web:sha-new",
    },
    updateStateDir,
  });

  assert.equal(state.currentVersion, "sha-old");
  assert.equal(state.latestVersion, "sha-new");
  assert.equal(state.newerAvailable, true);
  assert.equal(state.pendingOperation, null);
  assert.equal(state.lastUpdate?.status, "rolled_back");
  assert.equal(state.lastUpdate?.message, "Update validation failed.");
});

test("checkDeploymentState records the last check timestamp", async () => {
  const updateStateDir = await mkdtemp(path.join(os.tmpdir(), "alm-deploy-check-"));

  const state = await checkDeploymentState({
    now: () => new Date("2026-07-11T10:30:00Z"),
    updateStateDir,
  });

  assert.equal(state.lastCheckAt, "2026-07-11T10:30:00.000Z");
});

test("startDeploymentOperation records pending update requests for the host runner", async () => {
  const updateStateDir = await mkdtemp(path.join(os.tmpdir(), "alm-deploy-request-"));

  const result = await startDeploymentOperation(
    "update",
    { targetImage: "ghcr.io/peter-kung/alm-system-web:sha-next" },
    {
      now: () => new Date("2026-07-11T11:30:00Z"),
      updateStateDir,
    },
  );

  assert.deepEqual(result, { operation: "update", requested: true });
  assert.deepEqual(
    JSON.parse(await readFile(path.join(updateStateDir, "pending-operation.json"), "utf8")),
    {
      operation: "update",
      requestedAt: "2026-07-11T11:30:00.000Z",
      restoreDatabase: "false",
      targetImage: "ghcr.io/peter-kung/alm-system-web:sha-next",
    },
  );
});

test("startDeploymentOperation rejects unsafe target images", async () => {
  await assert.rejects(
    startDeploymentOperation(
      "update",
      { targetImage: "ghcr.io/example/image:latest --bad" },
      { updateStateDir: await mkdtemp(path.join(os.tmpdir(), "alm-deploy-unsafe-")) },
    ),
    /targetImage must not contain whitespace/,
  );
});

test("startDeploymentOperation does not replace an existing pending request", async () => {
  const updateStateDir = await mkdtemp(path.join(os.tmpdir(), "alm-deploy-pending-"));
  await startDeploymentOperation(
    "update",
    { targetImage: "ghcr.io/peter-kung/alm-system-web:sha-one" },
    { updateStateDir },
  );

  await assert.rejects(
    startDeploymentOperation(
      "update",
      { targetImage: "ghcr.io/peter-kung/alm-system-web:sha-two" },
      { updateStateDir },
    ),
    /deployment operation is already pending/,
  );

  const pending = JSON.parse(
    await readFile(path.join(updateStateDir, "pending-operation.json"), "utf8"),
  ) as { targetImage?: string };
  assert.equal(pending.targetImage, "ghcr.io/peter-kung/alm-system-web:sha-one");
});
