"use client";

import React, { FormEvent, useState } from "react";

import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";
import type { DeploymentState } from "@/modules/deployment";

type DeploymentSettingsFetch = typeof fetch;

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not checked";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function lastUpdateLabel(deployment: DeploymentState) {
  if (deployment.pendingOperation) {
    return `${deployment.pendingOperation.operation} requested at ${formatDateTime(
      deployment.pendingOperation.requestedAt,
    )}`;
  }

  if (!deployment.lastUpdate) {
    return "No update recorded";
  }

  return `${deployment.lastUpdate.status} at ${formatDateTime(
    deployment.lastUpdate.updatedAt,
  )}`;
}

export function DeploymentSettingsPanel({
  initialDeployment,
}: {
  initialDeployment: DeploymentState;
}) {
  return (
    <DeploymentSettingsPanelWithDependencies
      fetcher={fetch}
      initialDeployment={initialDeployment}
    />
  );
}

export function DeploymentSettingsPanelWithDependencies({
  fetcher,
  initialDeployment,
}: {
  fetcher: DeploymentSettingsFetch;
  initialDeployment: DeploymentState;
}) {
  const { isPending, runWorkspaceMutation } = useWorkspaceMutation();
  const [deployment, setDeployment] = useState(initialDeployment);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [targetImage, setTargetImage] = useState(initialDeployment.latestImage);
  const [restoreDatabase, setRestoreDatabase] = useState(false);

  async function refreshDeployment() {
    const response = await fetcher("/api/app/deployment", { method: "GET" });
    if (!response.ok) {
      throw new Error("Unable to refresh deployment state.");
    }

    const payload = (await response.json()) as { deployment: DeploymentState };
    setDeployment(payload.deployment);
    setTargetImage(payload.deployment.latestImage);
  }

  async function requestDeployment(
    path: string,
    body?: Record<string, unknown>,
  ) {
    const response = await fetcher(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : JSON.stringify({}),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(payload?.error ?? "Unable to start deployment operation.");
    }

    return response;
  }

  async function handleCheck() {
    await runWorkspaceMutation(async () => {
      setError(null);
      setNotice(null);

      try {
        const response = await requestDeployment("/api/app/deployment/check");
        const payload = (await response.json()) as { deployment: DeploymentState };
        setDeployment(payload.deployment);
        setTargetImage(payload.deployment.latestImage);
        setNotice("Version check recorded.");
      } catch (requestError) {
        setError((requestError as Error).message);
      }
    });
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedTargetImage = String(
      formData.get("targetImage") || targetImage || deployment.latestImage,
    );

    if (!window.confirm(`Start update to ${selectedTargetImage}?`)) {
      return;
    }

    await runWorkspaceMutation(async () => {
      setError(null);
      setNotice(null);

      try {
        await requestDeployment("/api/app/deployment/update", {
          targetImage: selectedTargetImage,
        });
        setNotice("Update requested. The host update runner will process it.");
        await refreshDeployment().catch(() => undefined);
      } catch (requestError) {
        setError((requestError as Error).message);
      }
    });
  }

  async function handleRollback() {
    if (!window.confirm("Start rollback to the previous recorded image?")) {
      return;
    }

    await runWorkspaceMutation(async () => {
      setError(null);
      setNotice(null);

      try {
        await requestDeployment("/api/app/deployment/rollback", { restoreDatabase });
        setNotice("Rollback requested. The host update runner will process it.");
        await refreshDeployment().catch(() => undefined);
      } catch (requestError) {
        setError((requestError as Error).message);
      }
    });
  }

  return (
    <section className="resource-card deployment-panel stack" aria-label="Deployment updates">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Deployment</p>
          <h2>Version and updates</h2>
        </div>
        <span
          className={`status-pill ${
            deployment.newerAvailable ? "status-incomplete" : "status-complete"
          }`}
        >
          {deployment.newerAvailable ? "Update target differs" : "Current target"}
        </span>
      </div>

      <dl className="detail-grid deployment-detail-grid">
        <div>
          <dt>Running version</dt>
          <dd>{deployment.currentVersion}</dd>
        </div>
        <div>
          <dt>Latest target</dt>
          <dd>{deployment.latestVersion}</dd>
        </div>
        <div>
          <dt>Last check</dt>
          <dd>{formatDateTime(deployment.lastCheckAt)}</dd>
        </div>
        <div>
          <dt>Last update</dt>
          <dd>{lastUpdateLabel(deployment)}</dd>
        </div>
      </dl>

      <div className="deployment-image-grid">
        <div className="stack">
          <p className="eyebrow">Current image</p>
          <code>{deployment.currentImage}</code>
        </div>
        <div className="stack">
          <p className="eyebrow">Target image</p>
          <code>{deployment.latestImage}</code>
        </div>
      </div>

      {deployment.lastUpdate?.message ? (
        <p className="issue-note">{deployment.lastUpdate.message}</p>
      ) : null}

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="success" role="status">
          {notice}
        </p>
      ) : null}

      <div className="deployment-actions">
        <button type="button" className="compact-button" disabled={isPending} onClick={handleCheck}>
          {isPending ? "Working..." : "Check updates"}
        </button>
        <form className="deployment-update-form" onSubmit={handleUpdate}>
          <label className="field">
            <span>Update image</span>
            <input
              name="targetImage"
              value={targetImage}
              onChange={(event) => setTargetImage(event.target.value)}
            />
          </label>
          <button type="submit" className="compact-button" disabled={isPending}>
            Start update
          </button>
        </form>
        <label className="toggle-field deployment-restore-field">
          <input
            type="checkbox"
            checked={restoreDatabase}
            onChange={(event) => setRestoreDatabase(event.target.checked)}
          />
          <span>Restore recorded database backup during rollback</span>
        </label>
        <button
          type="button"
          className="compact-button danger-button"
          disabled={isPending}
          onClick={handleRollback}
        >
          Start rollback
        </button>
      </div>
    </section>
  );
}
