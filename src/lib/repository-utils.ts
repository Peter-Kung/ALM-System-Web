import type { PrismaExecutor } from "@/lib/prisma-executor";

export class RepositoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryValidationError";
  }
}

export function assertNonEmptyString(value: string, fieldName: string) {
  if (value.trim().length === 0) {
    throw new RepositoryValidationError(`${fieldName} must not be empty.`);
  }
}

export function assertNonNegative(value: unknown, fieldName: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new RepositoryValidationError(`${fieldName} must be zero or greater.`);
  }
}

export function assertPositive(value: unknown, fieldName: string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    throw new RepositoryValidationError(`${fieldName} must be greater than zero.`);
  }
}

export function assertDateOrder(
  startDate: Date | string,
  endDate: Date | string | null | undefined,
  startFieldName: string,
  endFieldName: string,
) {
  const normalizedStartDate = new Date(startDate);
  const normalizedEndDate = endDate ? new Date(endDate) : null;

  if (
    Number.isNaN(normalizedStartDate.getTime()) ||
    (normalizedEndDate && Number.isNaN(normalizedEndDate.getTime()))
  ) {
    throw new RepositoryValidationError(
      `${startFieldName} and ${endFieldName} must be valid dates.`,
    );
  }

  if (normalizedEndDate && normalizedEndDate < normalizedStartDate) {
    throw new RepositoryValidationError(
      `${endFieldName} must be on or after ${startFieldName}.`,
    );
  }
}

export async function withWriteValidation<T>(
  db: PrismaExecutor,
  operation: (executor: PrismaExecutor) => Promise<T>,
) {
  if ("$transaction" in db) {
    return db.$transaction((transaction) => operation(transaction));
  }

  return operation(db);
}
