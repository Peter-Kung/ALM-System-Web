import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { runtimePaths } from "@/lib/runtime-paths";
import { RepositoryValidationError } from "@/lib/repository-utils";

export type DeploymentUpdateState = {
  status: string;
  fromImage: string;
  targetImage: string;
  activeImage: string;
  backupPath: string;
  message: string;
  updatedAt: string;
};

export type DeploymentState = {
  currentImage: string;
  currentVersion: string;
  latestImage: string;
  latestVersion: string;
  newerAvailable: boolean;
  lastCheckAt: string | null;
  pendingOperation: DeploymentOperationRequest | null;
  lastUpdate: DeploymentUpdateState | null;
};

export type DeploymentOperationRequest = {
  operation: "update" | "rollback";
  requestedAt: string;
  restoreDatabase: "true" | "false";
  targetImage: string;
};

type DeploymentEnvironment = Partial<NodeJS.ProcessEnv>;

export type DeploymentServiceDependencies = {
  environment?: DeploymentEnvironment;
  now?: () => Date;
  updateStateDir?: string;
};

const defaultImage = "ghcr.io/peter-kung/alm-system-web:latest";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeImage(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new RepositoryValidationError(`${fieldName} must be a non-empty string.`);
  }

  const image = value.trim();
  if (/\s/.test(image)) {
    throw new RepositoryValidationError(`${fieldName} must not contain whitespace.`);
  }

  return image;
}

function imageVersion(image: string) {
  const digestIndex = image.indexOf("@");
  if (digestIndex >= 0) {
    return image.slice(digestIndex + 1);
  }

  const lastSegment = image.split("/").at(-1) ?? image;
  const tagIndex = lastSegment.lastIndexOf(":");
  return tagIndex >= 0 ? lastSegment.slice(tagIndex + 1) : "latest";
}

function stateFile(updateStateDir: string) {
  return path.join(updateStateDir, "last-update.json");
}

function checkFile(updateStateDir: string) {
  return path.join(updateStateDir, "last-check.json");
}

function pendingOperationFile(updateStateDir: string) {
  return path.join(updateStateDir, "pending-operation.json");
}

async function readJsonFile(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writePendingOperationAtomically(
  updateStateDir: string,
  request: DeploymentOperationRequest,
) {
  const pendingPath = pendingOperationFile(updateStateDir);
  const temporaryPath = path.join(
    updateStateDir,
    `.pending-operation-${process.pid}-${Date.now()}.tmp`,
  );

  await writeFile(temporaryPath, `${JSON.stringify(request, null, 2)}\n`, {
    mode: 0o600,
  });

  try {
    await link(temporaryPath, pendingPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new RepositoryValidationError("A deployment operation is already pending.");
    }

    throw error;
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function parseUpdateState(value: unknown): DeploymentUpdateState | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    status: optionalString(value.status),
    fromImage: optionalString(value.fromImage),
    targetImage: optionalString(value.targetImage),
    activeImage: optionalString(value.activeImage),
    backupPath: optionalString(value.backupPath),
    message: optionalString(value.message),
    updatedAt: optionalString(value.updatedAt),
  };
}

function parseLastCheck(value: unknown) {
  if (!isRecord(value) || typeof value.checkedAt !== "string") {
    return null;
  }

  return value.checkedAt;
}

function parsePendingOperation(value: unknown): DeploymentOperationRequest | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.operation !== "update" && value.operation !== "rollback") {
    return null;
  }

  return {
    operation: value.operation,
    requestedAt: optionalString(value.requestedAt),
    restoreDatabase: value.restoreDatabase === "true" ? "true" : "false",
    targetImage: optionalString(value.targetImage),
  };
}

export async function getDeploymentState({
  environment = process.env,
  updateStateDir = runtimePaths.updateStateDir,
}: DeploymentServiceDependencies = {}): Promise<DeploymentState> {
  const currentImage = environment.ALM_IMAGE?.trim() || defaultImage;
  const latestImage = environment.ALM_UPDATE_TARGET_IMAGE?.trim() || defaultImage;
  const lastUpdate = parseUpdateState(await readJsonFile(stateFile(updateStateDir)));
  const lastCheckAt = parseLastCheck(await readJsonFile(checkFile(updateStateDir)));
  const pendingOperation = parsePendingOperation(
    await readJsonFile(pendingOperationFile(updateStateDir)),
  );

  return {
    currentImage,
    currentVersion: environment.ALM_VERSION?.trim() || imageVersion(currentImage),
    latestImage,
    latestVersion: imageVersion(latestImage),
    newerAvailable: currentImage !== latestImage,
    lastCheckAt,
    pendingOperation,
    lastUpdate,
  };
}

export async function checkDeploymentState({
  environment = process.env,
  now = () => new Date(),
  updateStateDir = runtimePaths.updateStateDir,
}: DeploymentServiceDependencies = {}) {
  await mkdir(updateStateDir, { recursive: true, mode: 0o700 });
  await writeFile(
    checkFile(updateStateDir),
    `${JSON.stringify({ checkedAt: now().toISOString() }, null, 2)}\n`,
    { mode: 0o600 },
  );

  return getDeploymentState({ environment, updateStateDir });
}

export async function startDeploymentOperation(
  operation: "update" | "rollback",
  options: {
    targetImage?: string;
    restoreDatabase?: boolean;
  } = {},
  {
    environment = process.env,
    now = () => new Date(),
    updateStateDir = runtimePaths.updateStateDir,
  }: DeploymentServiceDependencies = {},
) {
  const targetImage =
    operation === "update"
      ? normalizeImage(
          options.targetImage || environment.ALM_UPDATE_TARGET_IMAGE || defaultImage,
          "targetImage",
        )
      : "";
  const request: DeploymentOperationRequest = {
    operation,
    requestedAt: now().toISOString(),
    restoreDatabase: options.restoreDatabase ? "true" : "false",
    targetImage,
  };

  await mkdir(updateStateDir, { recursive: true, mode: 0o700 });
  await writePendingOperationAtomically(updateStateDir, request);

  return {
    operation,
    requested: true,
  };
}
