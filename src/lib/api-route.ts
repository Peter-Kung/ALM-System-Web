import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { RepositoryValidationError } from "@/lib/repository-utils";

export async function readJsonBody(request: NextRequest) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

export function getStringValue(
  payload: Record<string, unknown>,
  key: string,
): string;
export function getStringValue(
  payload: Record<string, unknown>,
  key: string,
  options: { optional: true; allowEmpty?: boolean },
): string | null;
export function getStringValue(
  payload: Record<string, unknown>,
  key: string,
  options?: { optional?: boolean; allowEmpty?: boolean },
): string | null {
  const value = payload[key];

  if (value == null || value === "") {
    if (options?.optional) {
      return null;
    }

    throw new RepositoryValidationError(`${key} is required.`);
  }

  if (typeof value !== "string") {
    throw new RepositoryValidationError(`${key} must be a string.`);
  }

  if (!options?.allowEmpty && value.trim().length === 0) {
    throw new RepositoryValidationError(`${key} must not be empty.`);
  }

  return value;
}

export function getBooleanValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  if (typeof value !== "boolean") {
    throw new RepositoryValidationError(`${key} must be a boolean.`);
  }

  return value;
}

export function getDecimalValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  if (typeof value !== "number" && typeof value !== "string") {
    throw new RepositoryValidationError(`${key} must be a number.`);
  }

  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new RepositoryValidationError(`${key} must be a valid number.`);
  }
}

export function getNullableStringValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new RepositoryValidationError(`${key} must be a string.`);
  }

  return value;
}

export function getEnumValue<T extends string>(
  payload: Record<string, unknown>,
  key: string,
  values: readonly T[],
) {
  const value = getStringValue(payload, key);

  if (!values.includes(value as T)) {
    throw new RepositoryValidationError(
      `${key} must be one of: ${values.join(", ")}.`,
    );
  }

  return value as T;
}

export function handleRouteError(error: unknown) {
  if (error instanceof RepositoryValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    return NextResponse.json({ error: "Record not found." }, { status: 404 });
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      { error: "A record with the same unique values already exists." },
      { status: 409 },
    );
  }

  console.error(error);

  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}
