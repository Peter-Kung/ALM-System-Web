import path from "node:path";

export type RuntimePaths = {
  backupDir: string;
  dataDir: string;
  databaseUrl: string;
  updateStateDir: string;
  uploadsDir: string;
};

type RuntimePathEnvironment = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "ALM_BACKUP_DIR"
    | "ALM_DATA_DIR"
    | "ALM_STORAGE_ROOT"
    | "ALM_UPDATE_STATE_DIR"
    | "ALM_UPLOADS_DIR"
    | "DATABASE_URL"
    | "NODE_ENV"
  >
>;

const DEFAULT_POSTGRESQL_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/alm_system_web?schema=public";

function defaultStorageRoot(environment: RuntimePathEnvironment) {
  return environment.NODE_ENV === "production" ? "/var/lib/alm-system" : ".";
}

function joinStoragePath(root: string, directory: string) {
  return path.join(root, directory);
}

function shouldUsePersistentDatabaseUrl(environment: RuntimePathEnvironment) {
  return Boolean(
    environment.DATABASE_URL ||
      environment.NODE_ENV === "production" ||
      environment.ALM_STORAGE_ROOT ||
      environment.ALM_DATA_DIR,
  );
}

export function resolveRuntimePaths(
  environment: RuntimePathEnvironment = process.env,
): RuntimePaths {
  const storageRoot = environment.ALM_STORAGE_ROOT ?? defaultStorageRoot(environment);
  const dataDir = environment.ALM_DATA_DIR ?? joinStoragePath(storageRoot, "data");
  const defaultDatabaseUrl = shouldUsePersistentDatabaseUrl(environment)
    ? DEFAULT_POSTGRESQL_URL
    : DEFAULT_POSTGRESQL_URL;

  return {
    backupDir: environment.ALM_BACKUP_DIR ?? joinStoragePath(storageRoot, "backups"),
    dataDir,
    databaseUrl: environment.DATABASE_URL ?? defaultDatabaseUrl,
    updateStateDir:
      environment.ALM_UPDATE_STATE_DIR ??
      joinStoragePath(storageRoot, "update-state"),
    uploadsDir: environment.ALM_UPLOADS_DIR ?? joinStoragePath(storageRoot, "uploads"),
  };
}

export const runtimePaths = resolveRuntimePaths();
