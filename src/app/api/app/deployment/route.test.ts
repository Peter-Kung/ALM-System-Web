import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest, NextResponse } from "next/server";

import {
  checkDeploymentHandler,
  getDeploymentHandler,
  startUpdateHandler,
  type DeploymentHandlerDependencies,
} from "@/app/api/app/deployment/handler";
import type { DeploymentState } from "@/modules/deployment";

const deployment: DeploymentState = {
  currentImage: "ghcr.io/peter-kung/alm-system-web:sha-old",
  currentVersion: "sha-old",
  latestImage: "ghcr.io/peter-kung/alm-system-web:sha-new",
  latestVersion: "sha-new",
  newerAvailable: true,
  lastCheckAt: null,
  pendingOperation: null,
  lastUpdate: null,
};

function createRequest(body: Record<string, unknown> = {}) {
  return new NextRequest("https://example.test/api/app/deployment/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createDependencies(role: "ADMIN" | "USER" = "ADMIN") {
  const operations: Array<{ operation: string; targetImage?: string }> = [];
  const dependencies: DeploymentHandlerDependencies = {
    async checkState() {
      return { ...deployment, lastCheckAt: "2026-07-11T10:30:00.000Z" };
    },
    async getState() {
      return deployment;
    },
    async requireSession() {
      return {
        response: null,
        session: {
          sub: "user-1",
          username: "owner",
          role,
          sessionVersion: 0,
        },
      };
    },
    async startOperation(operation, options) {
      operations.push({ operation, targetImage: options?.targetImage });
      return { operation, requested: true };
    },
  };

  return { dependencies, operations };
}

test("getDeploymentHandler returns deployment version state for administrators", async () => {
  const { dependencies } = createDependencies();

  const response = await getDeploymentHandler(dependencies);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deployment });
});

test("checkDeploymentHandler records and returns latest check state", async () => {
  const { dependencies } = createDependencies();

  const response = await checkDeploymentHandler(dependencies);
  const payload = (await response.json()) as { deployment: DeploymentState };

  assert.equal(response.status, 200);
  assert.equal(payload.deployment.lastCheckAt, "2026-07-11T10:30:00.000Z");
});

test("startUpdateHandler invokes host update operations for administrators", async () => {
  const { dependencies, operations } = createDependencies();

  const response = await startUpdateHandler(
    createRequest({ targetImage: "ghcr.io/peter-kung/alm-system-web:sha-new" }),
    dependencies,
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { operation: "update", requested: true });
  assert.deepEqual(operations, [
    {
      operation: "update",
      targetImage: "ghcr.io/peter-kung/alm-system-web:sha-new",
    },
  ]);
});

test("deployment handlers reject non-administrator sessions", async () => {
  const { dependencies, operations } = createDependencies("USER");

  const response = await startUpdateHandler(createRequest(), dependencies);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Administrator access required." });
  assert.deepEqual(operations, []);
});

test("deployment handlers forward unauthorized responses", async () => {
  const { dependencies } = createDependencies();
  dependencies.requireSession = async () => ({
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    session: null,
  });

  const response = await getDeploymentHandler(dependencies);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});
