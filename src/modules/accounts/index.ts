export const accountsModule = {
  name: "accounts",
};

export {
  patchAccountStatusForUser,
  type AccountStatusRepository,
} from "./account-status";
export { createAccountRepository } from "./repository";
