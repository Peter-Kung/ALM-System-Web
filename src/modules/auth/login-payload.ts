export type LoginPayload = {
  next?: string;
  password: string;
  username: string;
};

export function parseLoginPayload(payload: unknown): LoginPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as {
    next?: unknown;
    password?: unknown;
    username?: unknown;
  };

  if (
    typeof candidate.username !== "string" ||
    typeof candidate.password !== "string"
  ) {
    return null;
  }

  return {
    username: candidate.username,
    password: candidate.password,
    next: typeof candidate.next === "string" ? candidate.next : undefined,
  };
}
