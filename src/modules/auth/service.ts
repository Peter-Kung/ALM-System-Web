import bcrypt from "bcrypt";

import { env, requireFixedPassword } from "@/lib/env";
import {
  createAuthRepository,
  type AuthRepository,
  type AuthUser,
} from "@/modules/auth/repository";

const PASSWORD_SALT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

async function backfillLegacyOwner(
  repository: AuthRepository,
  user: AuthUser | null,
  password: string,
) {
  const passwordHash = await hashPassword(password);

  if (user) {
    return repository.update(user.id, {
      username: env.fixedUsername,
      passwordHash,
    });
  }

  const firstUser = await repository.findFirstUser();
  if (firstUser) {
    return repository.update(firstUser.id, {
      username: env.fixedUsername,
      passwordHash,
    });
  }

  return repository.create({
    username: env.fixedUsername,
    passwordHash,
  });
}

async function recoverFromBootstrapRace(
  repository: AuthRepository,
  password: string,
  error: unknown,
) {
  const user = await repository.findByUsername(env.fixedUsername);

  if (user?.passwordHash && (await verifyPassword(password, user.passwordHash))) {
    return user;
  }

  throw error;
}

export async function validateOwnerLogin(
  username: string,
  password: string,
  repository: AuthRepository = createAuthRepository(),
) {
  const trimmedUsername = username.trim();
  const user = await repository.findByUsername(trimmedUsername);

  if (user?.passwordHash) {
    const isValid = await verifyPassword(password, user.passwordHash);
    return isValid ? user : null;
  }

  const hashedUser = await repository.findFirstUserWithPasswordHash();
  if (hashedUser) {
    return null;
  }

  if (
    trimmedUsername !== env.fixedUsername ||
    password !== requireFixedPassword()
  ) {
    return null;
  }

  try {
    return await backfillLegacyOwner(repository, user, password);
  } catch (error) {
    return recoverFromBootstrapRace(repository, password, error);
  }
}
