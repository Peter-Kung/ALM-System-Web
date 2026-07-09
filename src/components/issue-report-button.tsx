"use client";

import { FormEvent, useRef, useState } from "react";

type IssueReportButtonProps = {
  pathname: string;
};

type SubmissionResult = {
  issueNumber: number;
  issueUrl: string;
};

export function IssueReportButton({ pathname }: IssueReportButtonProps) {
  const controllerRef = useRef<AbortController | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  function closeModal() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsOpen(false);
    setPending(false);
    setError(null);
    setResult(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    try {
      const response = await fetch("/api/app/report-issue", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          pagePath: pathname,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Unable to create issue report.");
        return;
      }

      const payload = (await response.json()) as SubmissionResult;
      setResult(payload);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      console.error(error);
      setError("Unable to create issue report.");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setPending(false);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        className="nav-link nav-link-footer nav-button"
        onClick={() => setIsOpen(true)}
      >
        <span className="nav-link-index">10</span>
        <span>Report issue</span>
      </button>
      {isOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card stack" role="dialog" aria-modal="true" aria-label="Report issue">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sidebar support</p>
                <h2>Report an issue</h2>
              </div>
              <button type="button" className="ghost-button compact-button" onClick={closeModal}>
                Close
              </button>
            </div>
            {result ? (
              <div className="stack">
                <p>Your report was created successfully.</p>
                <p className="muted">
                  Issue #{result.issueNumber} was opened for {pathname}.
                </p>
                <a href={result.issueUrl} target="_blank" rel="noreferrer">
                  Open GitHub issue
                </a>
              </div>
            ) : (
              <form className="stack" onSubmit={handleSubmit}>
                <p className="muted">
                  Submit a short problem report without leaving the workspace.
                </p>
                <label className="field">
                  <span>Title</span>
                  <input
                    name="title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Description</span>
                  <textarea
                    name="description"
                    rows={6}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                  />
                </label>
                <p className="muted">Current page: {pathname}</p>
                {error ? <p className="error">{error}</p> : null}
                <button type="submit" disabled={pending}>
                  {pending ? "Submitting..." : "Submit report"}
                </button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
