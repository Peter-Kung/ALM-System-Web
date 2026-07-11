import { NextResponse, type NextRequest } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { RepositoryValidationError } from "@/lib/repository-utils";
import {
  checkDeploymentState,
  getDeploymentState,
  startDeploymentOperation,
  type DeploymentState,
} from "@/modules/deployment";
import { deploymentControlsEnabled } from "@/modules/deployment/runtime";

type RequireApiSession = typeof requireApiSession;

export type DeploymentHandlerDependencies = {
  checkState: () => Promise<DeploymentState>;
  deploymentControlsEnabled: () => boolean;
  getState: () => Promise<DeploymentState>;
  requireSession: RequireApiSession;
  startOperation: typeof startDeploymentOperation;
};

export const defaultDeploymentHandlerDependencies: DeploymentHandlerDependencies = {
  checkState: () => checkDeploymentState(),
  deploymentControlsEnabled: () => deploymentControlsEnabled(),
  getState: () => getDeploymentState(),
  requireSession: requireApiSession,
  startOperation: startDeploymentOperation,
};

async function requireAdmin(dependencies: DeploymentHandlerDependencies) {
  if (!dependencies.deploymentControlsEnabled()) {
    return {
      response: NextResponse.json(
        { error: "Deployment controls are disabled for this runtime." },
        { status: 503 },
      ),
      session: null,
    };
  }

  const { response, session } = await dependencies.requireSession();
  if (response || !session) {
    return { response, session: null };
  }

  if (session.role !== "ADMIN") {
    return {
      response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }),
      session: null,
    };
  }

  return { response: null, session };
}

async function readOptionalJson(request: NextRequest) {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function getDeploymentHandler(
  dependencies: DeploymentHandlerDependencies = defaultDeploymentHandlerDependencies,
) {
  const { response } = await requireAdmin(dependencies);
  if (response) {
    return response;
  }

  return NextResponse.json({ deployment: await dependencies.getState() });
}

export async function checkDeploymentHandler(
  dependencies: DeploymentHandlerDependencies = defaultDeploymentHandlerDependencies,
) {
  const { response } = await requireAdmin(dependencies);
  if (response) {
    return response;
  }

  return NextResponse.json({ deployment: await dependencies.checkState() });
}

export async function startUpdateHandler(
  request: NextRequest,
  dependencies: DeploymentHandlerDependencies = defaultDeploymentHandlerDependencies,
) {
  const { response } = await requireAdmin(dependencies);
  if (response) {
    return response;
  }

  try {
    const payload = await readOptionalJson(request);
    const targetImage =
      typeof payload.targetImage === "string" && payload.targetImage.trim()
        ? payload.targetImage
        : undefined;

    return NextResponse.json(
      await dependencies.startOperation("update", { targetImage }),
      { status: 202 },
    );
  } catch (error) {
    return handleDeploymentError(error);
  }
}

export async function startRollbackHandler(
  request: NextRequest,
  dependencies: DeploymentHandlerDependencies = defaultDeploymentHandlerDependencies,
) {
  const { response } = await requireAdmin(dependencies);
  if (response) {
    return response;
  }

  try {
    const payload = await readOptionalJson(request);

    return NextResponse.json(
      await dependencies.startOperation("rollback", {
        restoreDatabase: payload.restoreDatabase === true,
      }),
      { status: 202 },
    );
  } catch (error) {
    return handleDeploymentError(error);
  }
}

function handleDeploymentError(error: unknown) {
  if (error instanceof RepositoryValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if ((error as NodeJS.ErrnoException).code === "ENOENT") {
    return NextResponse.json(
      { error: "Deployment update command is not available." },
      { status: 503 },
    );
  }

  console.error(error);
  return NextResponse.json({ error: "Unable to start deployment operation." }, { status: 500 });
}
