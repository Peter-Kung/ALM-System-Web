import { jwtVerify, SignJWT } from "jose";

import { requireSessionSecret } from "@/lib/env";

export const SESSION_COOKIE = "alm_session";
const encoder = new TextEncoder();

export type SessionPayload = {
  role: "ADMIN" | "USER";
  sessionVersion: number;
  sub: string;
  username: string;
};

function getSecret() {
  return encoder.encode(requireSessionSecret());
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({
    role: payload.role,
    sessionVersion: payload.sessionVersion,
    username: payload.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function readSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const verified = await jwtVerify(token, getSecret());
    const role = verified.payload.role;
    const sessionVersion = verified.payload.sessionVersion;
    const username = verified.payload.username;
    if (
      typeof verified.payload.sub !== "string" ||
      (role !== "ADMIN" && role !== "USER") ||
      typeof sessionVersion !== "number" ||
      typeof username !== "string"
    ) {
      return null;
    }

    return {
      role,
      sessionVersion,
      sub: verified.payload.sub,
      username,
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}
