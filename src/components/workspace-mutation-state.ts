export type WorkspaceMutationController = {
  isPending(): boolean;
  run<T>(operation: () => Promise<T>): Promise<T | undefined>;
};

export function createWorkspaceMutationController({
  initiallyPending = false,
  onPendingChange = () => undefined,
}: {
  initiallyPending?: boolean;
  onPendingChange?: (isPending: boolean) => void;
} = {}): WorkspaceMutationController {
  let pendingCount = initiallyPending ? 1 : 0;

  function setPendingCount(nextCount: number) {
    pendingCount = nextCount;
    onPendingChange(pendingCount > 0);
  }

  return {
    isPending() {
      return pendingCount > 0;
    },
    async run<T>(operation: () => Promise<T>) {
      if (pendingCount > 0) {
        return undefined;
      }

      setPendingCount(pendingCount + 1);

      try {
        return await operation();
      } finally {
        setPendingCount(Math.max(0, pendingCount - 1));
      }
    },
  };
}
