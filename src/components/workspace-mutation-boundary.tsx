"use client";

import React, { createContext, ReactNode, useContext, useMemo, useRef, useState } from "react";

type WorkspaceMutationContextValue = {
  isPending: boolean;
  runWorkspaceMutation<T>(operation: () => Promise<T>): Promise<T | undefined>;
};

const WorkspaceMutationContext = createContext<WorkspaceMutationContextValue | null>(null);

type WorkspaceMutationBoundaryProps = {
  children: ReactNode;
  initiallyPending?: boolean;
};

export function WorkspaceMutationBoundary({
  children,
  initiallyPending = false,
}: WorkspaceMutationBoundaryProps) {
  const [pendingCount, setPendingCount] = useState(initiallyPending ? 1 : 0);
  const pendingCountRef = useRef(pendingCount);

  function setTrackedPendingCount(nextCount: number) {
    pendingCountRef.current = nextCount;
    setPendingCount(nextCount);
  }

  const contextValue = useMemo<WorkspaceMutationContextValue>(
    () => ({
      isPending: pendingCount > 0,
      async runWorkspaceMutation<T>(operation: () => Promise<T>) {
        if (pendingCountRef.current > 0) {
          return undefined;
        }

        setTrackedPendingCount(pendingCountRef.current + 1);

        try {
          return await operation();
        } finally {
          setTrackedPendingCount(Math.max(0, pendingCountRef.current - 1));
        }
      },
    }),
    [pendingCount],
  );

  const isPending = pendingCount > 0;

  return (
    <WorkspaceMutationContext.Provider value={contextValue}>
      <div className="workspace-mutation-shell">
        <div
          className="workspace-mutation-content"
          aria-busy={isPending}
          inert={isPending ? true : undefined}
        >
          {children}
        </div>
        {isPending ? (
          <div
            className="workspace-mutation-overlay"
            role="status"
            aria-live="polite"
            aria-label="Workspace update in progress"
          >
            <div className="workspace-mutation-overlay-card stack">
              <div className="workspace-mutation-spinner" aria-hidden="true" />
              <div className="stack">
                <strong>Please wait</strong>
                <p className="muted">
                  The current workspace change is still running. Other page actions are
                  temporarily locked.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </WorkspaceMutationContext.Provider>
  );
}

export function useWorkspaceMutation() {
  const context = useContext(WorkspaceMutationContext);

  if (!context) {
    throw new Error("useWorkspaceMutation must be used within WorkspaceMutationBoundary.");
  }

  return context;
}
