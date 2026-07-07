import { prisma } from "@/lib/prisma";
import { env, requireFixedPassword } from "@/lib/env";

export async function ensureFixedUser() {
  return prisma.user.upsert({
    where: { username: env.fixedUsername },
    update: {},
    create: { username: env.fixedUsername },
  });
}

export async function validateFixedUserLogin(username: string, password: string) {
  if (username !== env.fixedUsername || password !== requireFixedPassword()) {
    return null;
  }

  return ensureFixedUser();
}
