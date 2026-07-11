import assert from "node:assert/strict";
import test from "node:test";

import { healthHandler } from "@/app/api/health/handler";

test("healthHandler reports ok after Prisma answers a database probe", async () => {
  let queryRan = false;

  const response = await healthHandler({
    prisma: {
      async $queryRaw() {
        queryRan = true;
        return [{ ok: 1 }];
      },
    },
  });

  assert.equal(response.status, 200);
  assert.equal(queryRan, true);
  assert.deepEqual(await response.json(), {
    status: "ok",
    checks: {
      database: "ok",
    },
  });
});

test("healthHandler fails when Prisma cannot query the database", async () => {
  const response = await healthHandler({
    prisma: {
      async $queryRaw() {
        throw new Error("database unavailable");
      },
    },
  });

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: "error",
    checks: {
      database: "error",
    },
  });
});
