export type AccountStatusRepository = {
  findById(accountId: string): Promise<{ userId: string } | null>;
  update(
    accountId: string,
    data: { isActive: boolean },
  ): Promise<{ isActive: boolean } & Record<string, unknown>>;
};

export async function patchAccountStatusForUser(
  repository: AccountStatusRepository,
  {
    accountId,
    userId,
    isActive,
  }: {
    accountId: string;
    userId: string;
    isActive: boolean;
  },
) {
  const existingAccount = await repository.findById(accountId);

  if (!existingAccount || existingAccount.userId !== userId) {
    return null;
  }

  return repository.update(accountId, {
    isActive,
  });
}
