import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimePaths } from "@/lib/runtime-paths";

test("resolveRuntimePaths derives persistent directories from a deployment root", () => {
  assert.deepEqual(
    resolveRuntimePaths({
      ALM_STORAGE_ROOT: "/opt/alm-system",
    }),
    {
      backupDir: "/opt/alm-system/backups",
      dataDir: "/opt/alm-system/data",
      databaseUrl: "file:/opt/alm-system/data/alm-system.db",
      updateStateDir: "/opt/alm-system/update-state",
      uploadsDir: "/opt/alm-system/uploads",
    },
  );
});

test("resolveRuntimePaths preserves the local development database default", () => {
  assert.equal(resolveRuntimePaths({ NODE_ENV: "development" }).databaseUrl, "file:./dev.db");
});

test("resolveRuntimePaths lets deployers override individual persistent paths", () => {
  assert.deepEqual(
    resolveRuntimePaths({
      ALM_BACKUP_DIR: "/mnt/backups",
      ALM_DATA_DIR: "/mnt/data",
      ALM_UPDATE_STATE_DIR: "/mnt/update",
      ALM_UPLOADS_DIR: "/mnt/uploads",
      DATABASE_URL: "file:/mnt/data/custom.db",
    }),
    {
      backupDir: "/mnt/backups",
      dataDir: "/mnt/data",
      databaseUrl: "file:/mnt/data/custom.db",
      updateStateDir: "/mnt/update",
      uploadsDir: "/mnt/uploads",
    },
  );
});
