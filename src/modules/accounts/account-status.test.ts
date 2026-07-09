import assert from "node:assert/strict";
import test from "node:test";

import { patchAccountStatusForUser } from "@/modules/accounts";

test("patchAccountStatusForUser updates only accounts owned by the signed-in user", async () => {
  let updated: { accountId: string; isActive: boolean } | null = null;

  const repository = {
    async findById(accountId: string) {
      return {
        id: accountId,
        userId: "owner-1",
      };
    },
    async update(accountId: string, data: { isActive: boolean }) {
      updated = { accountId, isActive: data.isActive };

      return {
        id: accountId,
        userId: "owner-1",
        isActive: data.isActive,
      };
    },
  };

  const account = await patchAccountStatusForUser(repository, {
    accountId: "account-1",
    userId: "owner-1",
    isActive: false,
  });

  assert.deepEqual(updated, { accountId: "account-1", isActive: false });
  assert.equal(account?.isActive, false);
});

test("patchAccountStatusForUser returns null for missing or foreign accounts", async () => {
  const repository = {
    async findById() {
      return {
        id: "account-1",
        userId: "owner-2",
      };
    },
    async update() {
      throw new Error("update should not run for a foreign account");
    },
  };

  const account = await patchAccountStatusForUser(repository, {
    accountId: "account-1",
    userId: "owner-1",
    isActive: false,
  });

  assert.equal(account, null);
});
