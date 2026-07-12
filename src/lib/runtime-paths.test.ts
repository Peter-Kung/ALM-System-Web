import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimePaths } from "@/lib/runtime-paths";

const DEFAULT_POSTGRESQL_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/alm_system_web?schema=public";

test("resolveRuntimePaths derives persistent directories from a deployment root", () => {
  assert.deepEqual(
    resolveRuntimePaths({
      ALM_STORAGE_ROOT: "/opt/alm-system",
    }),
    {
      backupDir: "/opt/alm-system/backups",
      dataDir: "/opt/alm-system/data",
      databaseUrl: DEFAULT_POSTGRESQL_URL,
      updateStateDir: "/opt/alm-system/update-state",
      uploadsDir: "/opt/alm-system/uploads",
    },
  );
});

test("resolveRuntimePaths defaults to the local PostgreSQL development database", () => {
  assert.equal(resolveRuntimePaths({ NODE_ENV: "development" }).databaseUrl, DEFAULT_POSTGRESQL_URL);
});

test("resolveRuntimePaths lets deployers override individual persistent paths", () => {
  assert.deepEqual(
    resolveRuntimePaths({
      ALM_BACKUP_DIR: "/mnt/backups",
      ALM_DATA_DIR: "/mnt/data",
      ALM_UPDATE_STATE_DIR: "/mnt/update",
      ALM_UPLOADS_DIR: "/mnt/uploads",
      DATABASE_URL: "postgresql://db.internal:5432/custom_alm?schema=public",
    }),
    {
      backupDir: "/mnt/backups",
      dataDir: "/mnt/data",
      databaseUrl: "postgresql://db.internal:5432/custom_alm?schema=public",
      updateStateDir: "/mnt/update",
      uploadsDir: "/mnt/uploads",
    },
  );
});
