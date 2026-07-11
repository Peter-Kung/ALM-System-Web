"use client";

import {
  AccountType,
  AssetPriceSourceType,
  AssetType,
  LiabilityType,
  UserRole,
} from "@prisma/client";
import React from "react";
import { FormEvent, useEffect, useState } from "react";

import { SnapshotManager } from "@/components/snapshot-manager";
import { ValuationManager } from "@/components/valuation-manager";
import { useWorkspaceMutation } from "@/components/workspace-mutation-boundary";
import { formatReadOnlyMoney } from "@/lib/read-only-money-format";

export type AccountRecord = {
  id: string;
  name: string;
  institutionName: string;
  accountType: AccountType;
  currency: string;
  cashBalance: string;
  isActive: boolean;
  notes: string | null;
};

export type AssetRecord = {
  id: string;
  name: string;
  assetType: AssetType;
  symbol: string | null;
  currency: string;
  priceSourceType: AssetPriceSourceType;
  isActive: boolean;
  notes: string | null;
};

type HoldingRecord = {
  id: string;
  accountId: string;
  assetId: string;
  quantity: string;
  isActive: boolean;
  notes: string | null;
  account: Pick<AccountRecord, "id" | "name" | "institutionName">;
  asset: Pick<AssetRecord, "id" | "name" | "symbol" | "assetType">;
};

type LiabilityRecord = {
  id: string;
  name: string;
  liabilityType: LiabilityType;
  currency: string;
  originalAmount: string;
  currentBalance: string;
  interestRate: string;
  monthlyPayment: string;
  startDate: string;
  endDate: string | null;
  paymentAccountId: string | null;
  isActive: boolean;
  notes: string | null;
  paymentAccount: Pick<AccountRecord, "id" | "name" | "institutionName"> | null;
};

type PriceRecord = {
  id: string;
  assetId: string;
  sourceType: "AUTO_REFRESH" | "MANUAL_ENTRY";
  currency: string;
  price: string;
  recordedAt: string;
  isValid: boolean;
  asset: Pick<AssetRecord, "id" | "name" | "symbol" | "currency" | "priceSourceType">;
};

type ManagedUserRecord = {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  sessionVersion: number;
  loginLockout: {
    failedAttempts: number;
    lockedUntil: string | null;
  };
  lastLoginAt: string | null;
  telegramBinding: {
    state: "BOUND" | "UNBOUND";
    telegramUsername: string | null;
    boundAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

type PriceRefreshResult = {
  refreshed: Array<{
    assetId: string;
    assetName: string;
    symbol: string;
    priceRecordId: string;
    price: string;
    currency: string;
    recordedAt: string;
  }>;
  failed: Array<{
    assetId: string;
    assetName: string;
    symbol: string | null;
    reason: string;
  }>;
};

type SectionProps = {
  section: string;
};

type AccountFormState = {
  name: string;
  institutionName: string;
  accountType: AccountType;
  currency: string;
  cashBalance: string;
  isActive: boolean;
  notes: string;
};

type AssetFormState = {
  name: string;
  assetType: AssetType;
  symbol: string;
  currency: string;
  priceSourceType: AssetPriceSourceType;
  isActive: boolean;
  notes: string;
};

type HoldingFormState = {
  accountId: string;
  assetId: string;
  quantity: string;
  isActive: boolean;
  notes: string;
};

type LiabilityFormState = {
  name: string;
  liabilityType: LiabilityType;
  currency: string;
  originalAmount: string;
  currentBalance: string;
  interestRate: string;
  monthlyPayment: string;
  startDate: string;
  endDate: string;
  paymentAccountId: string;
  isActive: boolean;
  notes: string;
};

type ManualPriceFormState = {
  assetId: string;
  currency: string;
  price: string;
  isValid: boolean;
};

type UserFormState = {
  displayName: string;
  username: string;
  role: UserRole;
  isActive: boolean;
};

const emptyAccountForm: AccountFormState = {
  name: "",
  institutionName: "",
  accountType: AccountType.BANK,
  currency: "TWD",
  cashBalance: "0",
  isActive: true,
  notes: "",
};

const emptyAssetForm: AssetFormState = {
  name: "",
  assetType: AssetType.STOCK,
  symbol: "",
  currency: "TWD",
  priceSourceType: AssetPriceSourceType.AUTO,
  isActive: true,
  notes: "",
};

const emptyHoldingForm: HoldingFormState = {
  accountId: "",
  assetId: "",
  quantity: "0",
  isActive: true,
  notes: "",
};

const emptyLiabilityForm: LiabilityFormState = {
  name: "",
  liabilityType: LiabilityType.MORTGAGE,
  currency: "TWD",
  originalAmount: "0",
  currentBalance: "0",
  interestRate: "0",
  monthlyPayment: "0",
  startDate: "",
  endDate: "",
  paymentAccountId: "",
  isActive: true,
  notes: "",
};

const emptyManualPriceForm: ManualPriceFormState = {
  assetId: "",
  currency: "",
  price: "",
  isValid: true,
};

const emptyUserForm: UserFormState = {
  displayName: "",
  username: "",
  role: UserRole.USER,
  isActive: true,
};

export function getAssetSymbolGuidance(priceSourceType: AssetPriceSourceType) {
  if (priceSourceType !== AssetPriceSourceType.AUTO) {
    return null;
  }

  return "Use the Yahoo Finance symbol format, for example AAPL or 2330.TW.";
}

export function AssetSymbolGuidance({
  priceSourceType,
}: {
  priceSourceType: AssetPriceSourceType;
}) {
  const guidance = getAssetSymbolGuidance(priceSourceType);

  return guidance ? <p className="muted">{guidance}</p> : null;
}

export function ManagementSection({ section }: SectionProps) {
  if (section === "accounts") {
    return <AccountsManager />;
  }

  if (section === "assets") {
    return <AssetsManager />;
  }

  if (section === "holdings") {
    return <HoldingsManager />;
  }

  if (section === "liabilities") {
    return <LiabilitiesManager />;
  }

  if (section === "prices") {
    return <PricesManager />;
  }

  if (section === "valuation") {
    return <ValuationManager />;
  }

  if (section === "snapshots") {
    return <SnapshotManager />;
  }

  if (section === "users") {
    return <UsersManager />;
  }

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Module scaffold</p>
        <h1>{section[0].toUpperCase() + section.slice(1)}</h1>
        <p className="muted">
          This protected page is reserved for the {section} domain workflow.
        </p>
      </div>
    </section>
  );
}

function UsersManager() {
  const { runWorkspaceMutation } = useWorkspaceMutation();
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [form, setForm] = useState<UserFormState>(emptyUserForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [requestingUserId, setRequestingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/users");
      const payload = (await response.json()) as {
        users?: ManagedUserRecord[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load users.");
      }

      setUsers(payload.users ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runWorkspaceMutation(async () => {
      setIsSaving(true);
      setError(null);
      setStatusMessage(null);

      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = (await response.json()) as {
          user?: ManagedUserRecord;
          error?: string;
        };

        if (!response.ok || !payload.user) {
          throw new Error(payload.error ?? "Failed to create user.");
        }

        setUsers((currentUsers) => [...currentUsers, payload.user as ManagedUserRecord]);
        setForm(emptyUserForm);
        setStatusMessage(`Created ${payload.user.username}.`);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to create user.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  async function updateUser(user: ManagedUserRecord, updates: Partial<UserFormState>) {
    await runWorkspaceMutation(async () => {
      setUpdatingUserId(user.id);
      setError(null);
      setStatusMessage(null);

      try {
        const response = await fetch(`/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const payload = (await response.json()) as {
          user?: ManagedUserRecord;
          error?: string;
        };

        if (!response.ok || !payload.user) {
          throw new Error(payload.error ?? "Failed to update user.");
        }

        setUsers((currentUsers) =>
          currentUsers.map((currentUser) =>
            currentUser.id === payload.user?.id ? payload.user : currentUser,
          ),
        );
        setStatusMessage(`Updated ${payload.user.username}.`);
      } catch (updateError) {
        setError(updateError instanceof Error ? updateError.message : "Failed to update user.");
      } finally {
        setUpdatingUserId(null);
      }
    });
  }

  async function requestUserAction(
    user: ManagedUserRecord,
    action: "activation-request" | "password-reset-request" | "telegram-binding-code",
  ) {
    await runWorkspaceMutation(async () => {
      setRequestingUserId(`${user.id}:${action}`);
      setError(null);
      setStatusMessage(null);

      try {
        const response = await fetch(`/api/admin/users/${user.id}/${action}`, {
          method: "POST",
        });
        const payload = (await response.json()) as {
          bindingCode?: string;
          delivery?: string;
          expiresAt?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to request user onboarding action.");
        }

        setStatusMessage(
          formatUserActionStatus(
            user.username,
            action,
            payload.delivery,
            payload.bindingCode,
            payload.expiresAt,
          ),
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Failed to request user onboarding action.",
        );
      } finally {
        setRequestingUserId(null);
      }
    });
  }

  const activeAdminCount = users.filter(
    (user) => user.role === UserRole.ADMIN && user.isActive,
  ).length;

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">User management</p>
        <h1>Users</h1>
        <p className="muted">
          Manage database-backed identities, roles, and access state while keeping
          passwords self-managed by each user.
        </p>
      </div>
      <div className="management-grid">
        <form className="card stack management-form-column" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div>
              <h2>Create user</h2>
              <p className="muted">
                Add a username and access level. Activation and password setup are
                requested separately.
              </p>
            </div>
          </div>
          <label className="field">
            <span>Display name</span>
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              placeholder="Family Member"
            />
          </label>
          <label className="field">
            <span>Username</span>
            <input
              required
              minLength={3}
              maxLength={32}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="family.member"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select
              value={form.role}
              onChange={(event) =>
                setForm({ ...form, role: event.target.value as UserRole })
              }
            >
              <option value={UserRole.USER}>User</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <span>Active</span>
          </label>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Creating..." : "Create user"}
          </button>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {statusMessage ? (
            <p className="success" role="status">
              {statusMessage}
            </p>
          ) : null}
        </form>

        <div className="card stack">
          <div className="section-heading">
            <div>
              <h2>User directory</h2>
              <p className="muted">
                {activeAdminCount} active admin{activeAdminCount === 1 ? "" : "s"} available.
              </p>
            </div>
            <button
              type="button"
              className="ghost-button compact-button"
              onClick={() => void loadUsers()}
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {isLoading ? <div className="placeholder">Loading users...</div> : null}
          {!isLoading && users.length === 0 ? (
            <div className="placeholder">No managed users are available yet.</div>
          ) : null}
          <div className="user-directory-list">
            {users.map((user) => (
              <UserRecordCard
                key={user.id}
                user={user}
                isUpdating={updatingUserId === user.id}
                requestingUserId={requestingUserId}
                onRoleChange={(role) => void updateUser(user, { role })}
                onStatusChange={(isActive) => void updateUser(user, { isActive })}
                onRequestActivation={() =>
                  void requestUserAction(user, "activation-request")
                }
                onRequestBindingCode={() =>
                  void requestUserAction(user, "telegram-binding-code")
                }
                onRequestPasswordReset={() =>
                  void requestUserAction(user, "password-reset-request")
                }
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatUserActionStatus(
  username: string,
  action: "activation-request" | "password-reset-request" | "telegram-binding-code",
  delivery?: string,
  bindingCode?: string,
  expiresAt?: string,
) {
  if (action === "telegram-binding-code") {
    const expiryLabel = expiresAt ? formatDateTime(expiresAt) : "soon";
    return bindingCode
      ? `Telegram binding code for ${username}: ${bindingCode}. Expires ${expiryLabel}.`
      : `Telegram binding code requested for ${username}.`;
  }

  if (delivery === "pending_self_managed_onboarding") {
    return `${username} is waiting for the self-managed onboarding flow; no password was issued.`;
  }

  return action === "activation-request"
    ? `Activation requested for ${username}.`
    : `Password reset requested for ${username}.`;
}

function UserRecordCard({
  user,
  isUpdating,
  requestingUserId,
  onRoleChange,
  onStatusChange,
  onRequestActivation,
  onRequestBindingCode,
  onRequestPasswordReset,
}: {
  user: ManagedUserRecord;
  isUpdating: boolean;
  requestingUserId: string | null;
  onRoleChange: (role: UserRole) => void;
  onStatusChange: (isActive: boolean) => void;
  onRequestActivation: () => void;
  onRequestBindingCode: () => void;
  onRequestPasswordReset: () => void;
}) {
  const activationRequestId = `${user.id}:activation-request`;
  const bindingCodeRequestId = `${user.id}:telegram-binding-code`;
  const passwordResetRequestId = `${user.id}:password-reset-request`;
  const bindingActionLabel =
    user.telegramBinding.state === "BOUND"
      ? "Regenerate binding code"
      : "Generate binding code";

  return (
    <article className="resource-card user-card stack">
      <div className="section-heading">
        <div>
          <h3>{user.username}</h3>
          {user.displayName ? <p className="muted">{user.displayName}</p> : null}
          <p className="muted">Last login {formatNullableDateTime(user.lastLoginAt)}</p>
        </div>
        <span
          className={`status-pill ${
            user.isActive ? "status-complete" : "status-incomplete"
          }`}
        >
          {user.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Role</dt>
          <dd>{formatEnumLabel(user.role)}</dd>
        </div>
        <div>
          <dt>Telegram</dt>
          <dd>{formatTelegramBindingLabel(user)}</dd>
        </div>
        <div>
          <dt>Lockout</dt>
          <dd>{formatLoginLockoutLabel(user)}</dd>
        </div>
        <div>
          <dt>Session version</dt>
          <dd>{user.sessionVersion}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(user.createdAt)}</dd>
        </div>
      </dl>
      <div className="user-card-controls">
        <label className="field">
          <span>Role</span>
          <select
            value={user.role}
            disabled={isUpdating}
            onChange={(event) => onRoleChange(event.target.value as UserRole)}
          >
            <option value={UserRole.USER}>User</option>
            <option value={UserRole.ADMIN}>Admin</option>
          </select>
        </label>
        <label className="toggle-field">
          <input
            type="checkbox"
            checked={user.isActive}
            disabled={isUpdating}
            onChange={(event) => onStatusChange(event.target.checked)}
          />
          <span>Active</span>
        </label>
      </div>
      <div className="account-card-actions">
        <button
          type="button"
          className="ghost-button compact-button"
          disabled={requestingUserId === bindingCodeRequestId}
          onClick={onRequestBindingCode}
        >
          {requestingUserId === bindingCodeRequestId ? "Requesting..." : bindingActionLabel}
        </button>
        {user.isActive ? (
          <button
            type="button"
            className="ghost-button compact-button"
            disabled={requestingUserId === passwordResetRequestId}
            onClick={onRequestPasswordReset}
          >
            {requestingUserId === passwordResetRequestId
              ? "Requesting..."
              : "Request password reset"}
          </button>
        ) : (
          <button
            type="button"
            className="ghost-button compact-button"
            disabled={requestingUserId === activationRequestId}
            onClick={onRequestActivation}
          >
            {requestingUserId === activationRequestId
              ? "Requesting..."
              : "Request activation"}
          </button>
        )}
      </div>
    </article>
  );
}

function formatLoginLockoutLabel(user: ManagedUserRecord) {
  if (user.loginLockout.lockedUntil) {
    return `Locked until ${formatDateTime(user.loginLockout.lockedUntil)}`;
  }

  if (user.loginLockout.failedAttempts > 0) {
    return `${user.loginLockout.failedAttempts} failed attempt${
      user.loginLockout.failedAttempts === 1 ? "" : "s"
    }`;
  }

  return "No active lockout";
}

function formatTelegramBindingLabel(user: ManagedUserRecord) {
  if (user.telegramBinding.state === "BOUND") {
    const usernameLabel = user.telegramBinding.telegramUsername
      ? `@${user.telegramBinding.telegramUsername}`
      : "bound account";
    const boundAtLabel = user.telegramBinding.boundAt
      ? ` since ${formatDateTime(user.telegramBinding.boundAt)}`
      : "";
    return `${usernameLabel}${boundAtLabel}`;
  }

  return "Waiting for Telegram binding";
}

export function formatCurrencyAmount(value: string, currency: string) {
  return formatReadOnlyMoney(value, {
    currency,
    currencyPosition: "prefix",
  });
}

export function getAccountActionLabel(
  account: Pick<AccountRecord, "name" | "institutionName">,
  action: "edit" | "archive" | "activate",
) {
  const target = `${account.name} at ${account.institutionName}`;

  switch (action) {
    case "edit":
      return `Edit ${target}`;
    case "archive":
      return `Archive ${target}`;
    case "activate":
      return `Mark ${target} active`;
  }
}

export function AccountRecordCard({
  account,
  isUpdating,
  onEdit,
  onToggleStatus,
}: {
  account: AccountRecord;
  isUpdating: boolean;
  onEdit: (account: AccountRecord) => void;
  onToggleStatus: (account: AccountRecord, isActive: boolean) => void;
}) {
  return (
    <article className="resource-card resource-card-account stack">
      <div className="section-heading">
        <div>
          <h3>{account.name}</h3>
          <p className="muted">{account.institutionName}</p>
        </div>
        <span
          className={`status-pill ${
            account.isActive ? "status-complete" : "status-incomplete"
          }`}
        >
          {account.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="account-card-balance">
        <p className="eyebrow">Cash balance</p>
        <strong>{formatCurrencyAmount(account.cashBalance, account.currency)}</strong>
      </div>
      <dl className="detail-grid detail-grid-accounts">
        <div>
          <dt>Account type</dt>
          <dd>{formatEnumLabel(account.accountType)}</dd>
        </div>
        <div>
          <dt>Currency</dt>
          <dd>{account.currency}</dd>
        </div>
      </dl>
      {account.notes ? <p className="muted">{account.notes}</p> : null}
      <div className="account-card-actions">
        <button
          type="button"
          aria-label={getAccountActionLabel(account, "edit")}
          className="ghost-button compact-button"
          onClick={() => onEdit(account)}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={
            account.isActive
              ? getAccountActionLabel(account, "archive")
              : getAccountActionLabel(account, "activate")
          }
          className="ghost-button compact-button"
          disabled={isUpdating}
          onClick={() => onToggleStatus(account, !account.isActive)}
        >
          {isUpdating ? "Updating..." : account.isActive ? "Archive" : "Mark active"}
        </button>
      </div>
    </article>
  );
}

export function AssetRecordCard({
  asset,
  onEdit,
}: {
  asset: AssetRecord;
  onEdit: (asset: AssetRecord) => void;
}) {
  return (
    <article className="resource-card stack">
      <div className="section-heading">
        <div>
          <h3>{asset.name}</h3>
          <p className="muted">
            {formatEnumLabel(asset.assetType)}
            {asset.symbol ? ` · ${asset.symbol}` : ""}
          </p>
        </div>
        <button
          type="button"
          className="ghost-button compact-button asset-card-edit-button"
          onClick={() => onEdit(asset)}
        >
          Edit
        </button>
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Currency</dt>
          <dd>{asset.currency}</dd>
        </div>
        <div>
          <dt>Pricing</dt>
          <dd>{formatEnumLabel(asset.priceSourceType)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{asset.isActive ? "Active" : "Inactive"}</dd>
        </div>
      </dl>
      {asset.notes ? <p className="muted">{asset.notes}</p> : null}
    </article>
  );
}

function AccountsManager() {
  const { runWorkspaceMutation } = useWorkspaceMutation();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAccounts();
  }, []);

  async function loadAccounts() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/accounts");
      const payload = (await response.json()) as { accounts?: AccountRecord[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load accounts.");
      }

      setAccounts(payload.accounts ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load accounts.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runWorkspaceMutation(async () => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(
          editingId ? `/api/accounts/${editingId}` : "/api/accounts",
          {
            method: editingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
            }),
          },
        );

        const payload = (await response.json()) as {
          account?: AccountRecord;
          error?: string;
        };

        if (!response.ok || !payload.account) {
          throw new Error(payload.error ?? "Failed to save account.");
        }

        const nextAccount = payload.account;

        setAccounts((currentAccounts) =>
          editingId
            ? currentAccounts.map((account) =>
                account.id === nextAccount.id ? nextAccount : account,
              )
            : [...currentAccounts, nextAccount],
        );
        reset();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save account.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function beginEdit(account: AccountRecord) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      institutionName: account.institutionName,
      accountType: account.accountType,
      currency: account.currency,
      cashBalance: account.cashBalance,
      isActive: account.isActive,
      notes: account.notes ?? "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyAccountForm);
  }

  async function toggleAccountStatus(account: AccountRecord, isActive: boolean) {
    await runWorkspaceMutation(async () => {
      setIsTogglingId(account.id);
      setError(null);

      try {
        const response = await fetch(`/api/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isActive,
          }),
        });

        const payload = (await response.json()) as {
          account?: AccountRecord;
          error?: string;
        };

        if (!response.ok || !payload.account) {
          throw new Error(payload.error ?? "Failed to update account status.");
        }

        setAccounts((currentAccounts) =>
          currentAccounts.map((currentAccount) =>
            currentAccount.id === payload.account?.id ? payload.account : currentAccount,
          ),
        );

        if (editingId === account.id) {
          setForm((currentForm) => ({ ...currentForm, isActive }));
        }
      } catch (statusError) {
        setError(
          statusError instanceof Error
            ? statusError.message
            : "Failed to update account status.",
        );
      } finally {
        setIsTogglingId(null);
      }
    });
  }

  const activeCount = accounts.filter((account) => account.isActive).length;
  const inactiveCount = accounts.length - activeCount;
  const institutionCount = new Set(accounts.map((account) => account.institutionName)).size;

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Account management</p>
        <h1>Accounts</h1>
        <p className="muted">
          Maintain cash, bank, and brokerage accounts with current balances and
          active status.
        </p>
        <div className="management-highlight-grid">
          <article className="management-highlight-card">
            <p className="eyebrow">Active accounts</p>
            <strong>{activeCount}</strong>
            <p className="muted">Available for valuation and payment workflows.</p>
          </article>
          <article className="management-highlight-card">
            <p className="eyebrow">Institutions</p>
            <strong>{institutionCount}</strong>
            <p className="muted">Grouped by the institutions you maintain here.</p>
          </article>
          <article className="management-highlight-card">
            <p className="eyebrow">Archived</p>
            <strong>{inactiveCount}</strong>
            <p className="muted">Inactive accounts stay visible without cluttering live data.</p>
          </article>
        </div>
      </div>
      <div className="management-grid management-grid-accounts">
        <div className="management-form-column">
          <form className="card stack" aria-label="Account editor" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{editingId ? "Edit account" : "Add account"}</h2>
            {editingId ? (
              <button type="button" className="ghost-button compact-button" onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>
          <label className="field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Institution</span>
            <input
              value={form.institutionName}
              onChange={(event) =>
                setForm({ ...form, institutionName: event.target.value })
              }
              required
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Account type</span>
              <select
                value={form.accountType}
                onChange={(event) =>
                  setForm({ ...form, accountType: event.target.value as AccountType })
                }
              >
                {Object.values(AccountType).map((accountType) => (
                  <option key={accountType} value={accountType}>
                    {formatEnumLabel(accountType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Currency</span>
              <input
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Cash balance</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cashBalance}
              onChange={(event) => setForm({ ...form, cashBalance: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={4}
            />
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <span>Active account</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Save account" : "Create account"}
          </button>
          </form>
        </div>
        <section className="stack" aria-label="Account record list">
          <div className="section-heading">
            <div>
              <h2>Existing accounts</h2>
              <p className="muted">Card-based workspace view for every maintained account.</p>
            </div>
            <p className="muted">{accounts.length} account records</p>
          </div>
          {isLoading ? <div className="placeholder">Loading accounts...</div> : null}
          {!isLoading && accounts.length === 0 ? (
            <div className="placeholder">No accounts yet. Create the first account.</div>
          ) : null}
          {accounts.map((account) => (
            <AccountRecordCard
              key={account.id}
              account={account}
              isUpdating={isTogglingId === account.id}
              onEdit={beginEdit}
              onToggleStatus={toggleAccountStatus}
            />
          ))}
        </section>
      </div>
    </section>
  );
}

function AssetsManager() {
  const { runWorkspaceMutation } = useWorkspaceMutation();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [form, setForm] = useState<AssetFormState>(emptyAssetForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAssets();
  }, []);

  async function loadAssets() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/assets");
      const payload = (await response.json()) as { assets?: AssetRecord[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load assets.");
      }

      setAssets(payload.assets ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load assets.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runWorkspaceMutation(async () => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(editingId ? `/api/assets/${editingId}` : "/api/assets", {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const payload = (await response.json()) as { asset?: AssetRecord; error?: string };

        if (!response.ok || !payload.asset) {
          throw new Error(payload.error ?? "Failed to save asset.");
        }

        const nextAsset = payload.asset;

        setAssets((currentAssets) =>
          editingId
            ? currentAssets.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset))
            : [...currentAssets, nextAsset],
        );
        reset();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save asset.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function beginEdit(asset: AssetRecord) {
    setEditingId(asset.id);
    setForm({
      name: asset.name,
      assetType: asset.assetType,
      symbol: asset.symbol ?? "",
      currency: asset.currency,
      priceSourceType: asset.priceSourceType,
      isActive: asset.isActive,
      notes: asset.notes ?? "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyAssetForm);
  }

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Asset management</p>
        <h1>Assets</h1>
        <p className="muted">
          Define instruments once, then reuse them across holdings and pricing
          workflows.
        </p>
      </div>
      <div className="management-grid">
        <div className="management-form-column">
          <form className="card stack" onSubmit={handleSubmit}>
            <div className="section-heading">
              <h2>{editingId ? "Edit asset" : "Add asset"}</h2>
              {editingId ? (
                <button type="button" className="ghost-button compact-button" onClick={reset}>
                  Cancel
                </button>
              ) : null}
            </div>
            <label className="field">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Asset type</span>
                <select
                  value={form.assetType}
                  onChange={(event) =>
                    setForm({ ...form, assetType: event.target.value as AssetType })
                  }
                >
                  {Object.values(AssetType).map((assetType) => (
                    <option key={assetType} value={assetType}>
                      {formatEnumLabel(assetType)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Currency</span>
                <input
                  value={form.currency}
                  onChange={(event) => setForm({ ...form, currency: event.target.value })}
                  required
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field">
                <span>Symbol</span>
                <input
                  value={form.symbol}
                  onChange={(event) => setForm({ ...form, symbol: event.target.value })}
                />
                <AssetSymbolGuidance priceSourceType={form.priceSourceType} />
              </label>
              <label className="field">
                <span>Price source</span>
                <select
                  value={form.priceSourceType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      priceSourceType: event.target.value as AssetPriceSourceType,
                    })
                  }
                >
                  {Object.values(AssetPriceSourceType).map((priceSourceType) => (
                    <option key={priceSourceType} value={priceSourceType}>
                      {formatEnumLabel(priceSourceType)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={4}
              />
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
              />
              <span>Active asset</span>
            </label>
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : editingId ? "Save asset" : "Create asset"}
            </button>
          </form>
        </div>
        <div className="stack">
          <div className="section-heading">
            <h2>Existing assets</h2>
            <p className="muted">{assets.length} asset records</p>
          </div>
          {isLoading ? <div className="placeholder">Loading assets...</div> : null}
          {!isLoading && assets.length === 0 ? (
            <div className="placeholder">No assets yet. Create the first asset.</div>
          ) : null}
          {assets.map((asset) => (
            <AssetRecordCard key={asset.id} asset={asset} onEdit={beginEdit} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HoldingsManager() {
  const { runWorkspaceMutation } = useWorkspaceMutation();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [holdings, setHoldings] = useState<HoldingRecord[]>([]);
  const [form, setForm] = useState<HoldingFormState>(emptyHoldingForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [accountsResponse, assetsResponse, holdingsResponse] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/assets"),
        fetch("/api/holdings"),
      ]);

      const [accountsPayload, assetsPayload, holdingsPayload] = (await Promise.all([
        accountsResponse.json(),
        assetsResponse.json(),
        holdingsResponse.json(),
      ])) as [
        { accounts?: AccountRecord[]; error?: string },
        { assets?: AssetRecord[]; error?: string },
        { holdings?: HoldingRecord[]; error?: string },
      ];

      if (!accountsResponse.ok) {
        throw new Error(accountsPayload.error ?? "Failed to load accounts.");
      }

      if (!assetsResponse.ok) {
        throw new Error(assetsPayload.error ?? "Failed to load assets.");
      }

      if (!holdingsResponse.ok) {
        throw new Error(holdingsPayload.error ?? "Failed to load holdings.");
      }

      const nextAccounts = accountsPayload.accounts ?? [];
      const nextAssets = assetsPayload.assets ?? [];

      setAccounts(nextAccounts);
      setAssets(nextAssets);
      setHoldings(holdingsPayload.holdings ?? []);
      setForm((currentForm) => ({
        ...currentForm,
        accountId: currentForm.accountId || nextAccounts[0]?.id || "",
        assetId: currentForm.assetId || nextAssets[0]?.id || "",
      }));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load holdings.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runWorkspaceMutation(async () => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(
          editingId ? `/api/holdings/${editingId}` : "/api/holdings",
          {
            method: editingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
            }),
          },
        );

        const payload = (await response.json()) as { holding?: HoldingRecord; error?: string };

        if (!response.ok || !payload.holding) {
          throw new Error(payload.error ?? "Failed to save holding.");
        }

        const nextHolding = {
          ...payload.holding,
          account:
            accounts.find((account) => account.id === payload.holding?.accountId) ??
            payload.holding.account,
          asset:
            assets.find((asset) => asset.id === payload.holding?.assetId) ?? payload.holding.asset,
        };

        setHoldings((currentHoldings) =>
          editingId
            ? currentHoldings.map((holding) =>
                holding.id === nextHolding.id ? nextHolding : holding,
              )
            : [...currentHoldings, nextHolding],
        );
        reset();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Failed to save holding.");
      } finally {
        setIsSaving(false);
      }
    });
  }

  function beginEdit(holding: HoldingRecord) {
    setEditingId(holding.id);
    setForm({
      accountId: holding.accountId,
      assetId: holding.assetId,
      quantity: holding.quantity,
      isActive: holding.isActive,
      notes: holding.notes ?? "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm({
      ...emptyHoldingForm,
      accountId: accounts[0]?.id ?? "",
      assetId: assets[0]?.id ?? "",
    });
  }

  const canManageHoldings = accounts.length > 0 && assets.length > 0;

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Holding management</p>
        <h1>Holdings</h1>
        <p className="muted">
          Link assets to accounts and maintain position quantities without
          duplicating the asset definition.
        </p>
      </div>
      <div className="management-grid">
        <div className="management-form-column">
          <form className="card stack" onSubmit={handleSubmit}>
            <div className="section-heading">
              <h2>{editingId ? "Edit holding" : "Add holding"}</h2>
              {editingId ? (
                <button type="button" className="ghost-button compact-button" onClick={reset}>
                  Cancel
                </button>
              ) : null}
            </div>
            <label className="field">
              <span>Account</span>
              <select
                value={form.accountId}
                onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                disabled={!canManageHoldings}
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.institutionName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Asset</span>
              <select
                value={form.assetId}
                onChange={(event) => setForm({ ...form, assetId: event.target.value })}
                disabled={!canManageHoldings}
              >
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                    {asset.symbol ? ` · ${asset.symbol}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quantity</span>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={form.quantity}
                onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                disabled={!canManageHoldings}
                required
              />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={4}
                disabled={!canManageHoldings}
              />
            </label>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                disabled={!canManageHoldings}
              />
              <span>Active holding</span>
            </label>
            {!canManageHoldings ? (
              <p className="muted">
                Create at least one account and one asset before adding holdings.
              </p>
            ) : null}
            {error ? <p className="error">{error}</p> : null}
            <button type="submit" disabled={isSaving || !canManageHoldings}>
              {isSaving ? "Saving..." : editingId ? "Save holding" : "Create holding"}
            </button>
          </form>
        </div>
        <div className="stack">
          <div className="section-heading">
            <h2>Existing holdings</h2>
            <p className="muted">{holdings.length} holding records</p>
          </div>
          {isLoading ? <div className="placeholder">Loading holdings...</div> : null}
          {!isLoading && holdings.length === 0 ? (
            <div className="placeholder">No holdings yet. Create the first holding.</div>
          ) : null}
          {holdings.map((holding) => (
            <article key={holding.id} className="resource-card stack">
              <div className="section-heading">
                <div>
                  <h3>{holding.asset.name}</h3>
                  <p className="muted">
                    {holding.account.name} · {holding.account.institutionName}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() => beginEdit(holding)}
                >
                  Edit
                </button>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Quantity</dt>
                  <dd>{holding.quantity}</dd>
                </div>
                <div>
                  <dt>Asset type</dt>
                  <dd>{formatEnumLabel(holding.asset.assetType)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{holding.isActive ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
              {holding.notes ? <p className="muted">{holding.notes}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiabilitiesManager() {
  const { runWorkspaceMutation } = useWorkspaceMutation();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRecord[]>([]);
  const [form, setForm] = useState<LiabilityFormState>(emptyLiabilityForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [accountsResponse, liabilitiesResponse] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/liabilities"),
      ]);

      const [accountsPayload, liabilitiesPayload] = (await Promise.all([
        accountsResponse.json(),
        liabilitiesResponse.json(),
      ])) as [
        { accounts?: AccountRecord[]; error?: string },
        { liabilities?: LiabilityRecord[]; error?: string },
      ];

      if (!accountsResponse.ok) {
        throw new Error(accountsPayload.error ?? "Failed to load accounts.");
      }

      if (!liabilitiesResponse.ok) {
        throw new Error(liabilitiesPayload.error ?? "Failed to load liabilities.");
      }

      setAccounts(accountsPayload.accounts ?? []);
      setLiabilities(liabilitiesPayload.liabilities ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load liabilities.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runWorkspaceMutation(async () => {
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(
          editingId ? `/api/liabilities/${editingId}` : "/api/liabilities",
          {
            method: editingId ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          },
        );

        const payload = (await response.json()) as {
          liability?: LiabilityRecord;
          error?: string;
        };

        if (!response.ok || !payload.liability) {
          throw new Error(payload.error ?? "Failed to save liability.");
        }

        const nextLiability = payload.liability;

        setLiabilities((currentLiabilities) =>
          editingId
            ? currentLiabilities.map((liability) =>
                liability.id === nextLiability.id ? nextLiability : liability,
              )
            : [...currentLiabilities, nextLiability],
        );
        reset();
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save liability.",
        );
      } finally {
        setIsSaving(false);
      }
    });
  }

  function beginEdit(liability: LiabilityRecord) {
    setEditingId(liability.id);
    setForm({
      name: liability.name,
      liabilityType: liability.liabilityType,
      currency: liability.currency,
      originalAmount: liability.originalAmount,
      currentBalance: liability.currentBalance,
      interestRate: liability.interestRate,
      monthlyPayment: liability.monthlyPayment,
      startDate: toDateInputValue(liability.startDate),
      endDate: toDateInputValue(liability.endDate),
      paymentAccountId: liability.paymentAccountId ?? "",
      isActive: liability.isActive,
      notes: liability.notes ?? "",
    });
  }

  function reset() {
    setEditingId(null);
    setForm(emptyLiabilityForm);
  }

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Liability management</p>
        <h1>Liabilities</h1>
        <p className="muted">
          Maintain mortgages and personal loans with balances, payment pressure,
          and optional payment-account links.
        </p>
      </div>
      <div className="management-grid">
        <form className="card stack management-form-column" onSubmit={handleSubmit}>
          <div className="section-heading">
            <h2>{editingId ? "Edit liability" : "Add liability"}</h2>
            {editingId ? (
              <button type="button" className="ghost-button compact-button" onClick={reset}>
                Cancel
              </button>
            ) : null}
          </div>
          <label className="field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              required
            />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Liability type</span>
              <select
                value={form.liabilityType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    liabilityType: event.target.value as LiabilityType,
                  })
                }
              >
                {Object.values(LiabilityType).map((liabilityType) => (
                  <option key={liabilityType} value={liabilityType}>
                    {formatEnumLabel(liabilityType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Currency</span>
              <input
                value={form.currency}
                onChange={(event) => setForm({ ...form, currency: event.target.value })}
                required
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Original amount</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.originalAmount}
                onChange={(event) =>
                  setForm({ ...form, originalAmount: event.target.value })
                }
                required
              />
            </label>
            <label className="field">
              <span>Current balance</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.currentBalance}
                onChange={(event) =>
                  setForm({ ...form, currentBalance: event.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Interest rate</span>
              <input
                type="number"
                step="0.0001"
                min="0"
                value={form.interestRate}
                onChange={(event) =>
                  setForm({ ...form, interestRate: event.target.value })
                }
                required
              />
            </label>
            <label className="field">
              <span>Monthly payment</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.monthlyPayment}
                onChange={(event) =>
                  setForm({ ...form, monthlyPayment: event.target.value })
                }
                required
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Start date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>End date</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm({ ...form, endDate: event.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span>Payment account</span>
            <select
              value={form.paymentAccountId}
              onChange={(event) =>
                setForm({ ...form, paymentAccountId: event.target.value })
              }
            >
              <option value="">No payment account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.institutionName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              rows={4}
            />
          </label>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            <span>Active liability</span>
          </label>
          {error ? <p className="error">{error}</p> : null}
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : editingId ? "Save liability" : "Create liability"}
          </button>
        </form>
        <div className="stack">
          <div className="section-heading">
            <h2>Existing liabilities</h2>
            <p className="muted">{liabilities.length} liability records</p>
          </div>
          {isLoading ? <div className="placeholder">Loading liabilities...</div> : null}
          {!isLoading && liabilities.length === 0 ? (
            <div className="placeholder">No liabilities yet. Create the first liability.</div>
          ) : null}
          {liabilities.map((liability) => (
            <article key={liability.id} className="resource-card stack">
              <div className="section-heading">
                <div>
                  <h3>{liability.name}</h3>
                  <p className="muted">
                    {formatEnumLabel(liability.liabilityType)}
                    {liability.paymentAccount
                      ? ` · ${liability.paymentAccount.name}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() => beginEdit(liability)}
                >
                  Edit
                </button>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Current balance</dt>
                  <dd>{formatCurrencyAmount(liability.currentBalance, liability.currency)}</dd>
                </div>
                <div>
                  <dt>Monthly payment</dt>
                  <dd>{formatCurrencyAmount(liability.monthlyPayment, liability.currency)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{liability.isActive ? "Active" : "Inactive"}</dd>
                </div>
                <div>
                  <dt>Interest rate</dt>
                  <dd>{liability.interestRate}</dd>
                </div>
                <div>
                  <dt>Schedule</dt>
                  <dd>
                    {toDateInputValue(liability.startDate)}
                    {liability.endDate
                      ? ` to ${toDateInputValue(liability.endDate)}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt>Payment account</dt>
                  <dd>
                    {liability.paymentAccount
                      ? `${liability.paymentAccount.name} · ${liability.paymentAccount.institutionName}`
                      : "None"}
                  </dd>
                </div>
              </dl>
              {liability.notes ? <p className="muted">{liability.notes}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricesManager() {
  const { runWorkspaceMutation } = useWorkspaceMutation();
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [priceRecords, setPriceRecords] = useState<PriceRecord[]>([]);
  const [manualForm, setManualForm] = useState<ManualPriceFormState>(emptyManualPriceForm);
  const [refreshResult, setRefreshResult] = useState<PriceRefreshResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingManualPrice, setIsSavingManualPrice] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    setError(null);

    try {
      const [assetsResponse, pricesResponse] = await Promise.all([
        fetch("/api/assets"),
        fetch("/api/prices"),
      ]);

      const [assetsPayload, pricesPayload] = (await Promise.all([
        assetsResponse.json(),
        pricesResponse.json(),
      ])) as [
        { assets?: AssetRecord[]; error?: string },
        { priceRecords?: PriceRecord[]; error?: string },
      ];

      if (!assetsResponse.ok) {
        throw new Error(assetsPayload.error ?? "Failed to load assets.");
      }

      if (!pricesResponse.ok) {
        throw new Error(pricesPayload.error ?? "Failed to load prices.");
      }

      const nextAssets = assetsPayload.assets ?? [];
      const nextPriceRecords = pricesPayload.priceRecords ?? [];
      const nextManualAssets = nextAssets.filter(
        (asset) => asset.isActive && asset.priceSourceType === AssetPriceSourceType.MANUAL,
      );

      setAssets(nextAssets);
      setPriceRecords(nextPriceRecords);
      setManualForm((currentForm) => ({
        ...currentForm,
        assetId:
          nextManualAssets.find((asset) => asset.id === currentForm.assetId)?.id ??
          nextManualAssets[0]?.id ??
          "",
        currency:
          nextManualAssets.find((asset) => asset.id === currentForm.assetId)?.currency ??
          nextManualAssets[0]?.currency ??
          "",
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load prices.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runWorkspaceMutation(async () => {
      setIsSavingManualPrice(true);
      setError(null);

      try {
        const response = await fetch("/api/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...manualForm,
            price: manualForm.price,
          }),
        });

        const payload = (await response.json()) as {
          priceRecord?: PriceRecord;
          error?: string;
        };

        if (!response.ok || !payload.priceRecord) {
          throw new Error(payload.error ?? "Failed to save price record.");
        }

        const nextPriceRecord = payload.priceRecord;
        setPriceRecords((currentRecords) =>
          mergeLatestPriceRecord(currentRecords, nextPriceRecord),
        );

        const selectedAsset = manualAssets.find((asset) => asset.id === manualForm.assetId);

        setManualForm({
          assetId: selectedAsset?.id ?? manualAssets[0]?.id ?? "",
          currency: selectedAsset?.currency ?? manualAssets[0]?.currency ?? "",
          price: "",
          isValid: true,
        });
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Failed to save price record.",
        );
      } finally {
        setIsSavingManualPrice(false);
      }
    });
  }

  async function handleRefresh() {
    await runWorkspaceMutation(async () => {
      setIsRefreshing(true);
      setError(null);
      setRefreshResult(null);

      try {
        const response = await fetch("/api/prices/refresh", { method: "POST" });
        const payload = (await response.json()) as PriceRefreshResult & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to refresh prices.");
        }

        setRefreshResult(payload);
        if (payload.refreshed.length > 0) {
          await loadData();
        }
      } catch (refreshError) {
        setError(
          refreshError instanceof Error ? refreshError.message : "Failed to refresh prices.",
        );
      } finally {
        setIsRefreshing(false);
      }
    });
  }

  const manualAssets = assets.filter(
    (asset) => asset.isActive && asset.priceSourceType === AssetPriceSourceType.MANUAL,
  );
  const autoAssets = assets.filter(
    (asset) => asset.isActive && asset.priceSourceType === AssetPriceSourceType.AUTO,
  );
  const latestPriceByAssetId = new Map(
    priceRecords.map((priceRecord) => [priceRecord.assetId, priceRecord] as const),
  );
  const selectedManualAsset =
    manualAssets.find((asset) => asset.id === manualForm.assetId) ?? manualAssets[0] ?? null;

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Price records</p>
        <h1>Prices</h1>
        <p className="muted">
          Refresh market prices for auto-priced assets and record manual fund prices
          without leaving the authenticated workspace.
        </p>
      </div>
      <div className="management-grid">
        <div className="stack management-form-column">
          <div className="card stack">
            <div className="section-heading">
              <div>
                <h2>Automatic refresh</h2>
                <p className="muted">
                  Fetch the latest quote for each active auto-priced asset.
                </p>
              </div>
              <button
                type="button"
                className="ghost-button compact-button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing || autoAssets.length === 0}
              >
                {isRefreshing ? "Refreshing..." : "Refresh prices"}
              </button>
            </div>
            {autoAssets.length === 0 ? (
              <div className="placeholder">
                No active auto-priced assets are available for refresh yet.
              </div>
            ) : null}
            {refreshResult ? (
              <div className="stack">
                <p className="muted">
                  Updated {refreshResult.refreshed.length} assets. Failed on{" "}
                  {refreshResult.failed.length}.
                </p>
                {refreshResult.refreshed.map((entry) => (
                  <article key={entry.priceRecordId} className="resource-card stack">
                    <div className="section-heading">
                      <div>
                        <h3>{entry.assetName}</h3>
                        <p className="muted">{entry.symbol}</p>
                      </div>
                      <strong>{formatCurrencyAmount(entry.price, entry.currency)}</strong>
                    </div>
                    <p className="muted">Recorded at {formatDateTime(entry.recordedAt)}</p>
                  </article>
                ))}
                {refreshResult.failed.map((entry) => (
                  <article key={entry.assetId} className="resource-card stack">
                    <div>
                      <h3>{entry.assetName}</h3>
                      <p className="muted">
                        {entry.symbol ? `${entry.symbol} · ` : ""}
                        {entry.reason}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
          <form className="card stack" onSubmit={handleManualSubmit}>
            <div className="section-heading">
              <div>
                <h2>Manual entry</h2>
                <p className="muted">
                  Save the latest operator-supplied price for manually priced assets.
                </p>
              </div>
            </div>
            <label className="field">
              <span>Asset</span>
              <select
                value={manualForm.assetId}
                onChange={(event) => {
                  const asset = manualAssets.find((candidate) => candidate.id === event.target.value);
                  setManualForm({
                    ...manualForm,
                    assetId: event.target.value,
                    currency: asset?.currency ?? manualForm.currency,
                  });
                }}
                disabled={manualAssets.length === 0}
              >
                {manualAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                    {asset.symbol ? ` · ${asset.symbol}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="field-row">
              <label className="field">
                <span>Currency</span>
                <input
                  value={manualForm.currency}
                  onChange={(event) =>
                    setManualForm({ ...manualForm, currency: event.target.value })
                  }
                  disabled={manualAssets.length === 0}
                  required
                />
              </label>
              <label className="field">
                <span>Price</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={manualForm.price}
                  onChange={(event) =>
                    setManualForm({ ...manualForm, price: event.target.value })
                  }
                  disabled={manualAssets.length === 0}
                  required
                />
              </label>
            </div>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={manualForm.isValid}
                onChange={(event) =>
                  setManualForm({ ...manualForm, isValid: event.target.checked })
                }
                disabled={manualAssets.length === 0}
              />
              <span>Mark this price record as valid</span>
            </label>
            {manualAssets.length === 0 ? (
              <div className="placeholder">
                Add an active asset with `Manual` pricing before saving price records.
              </div>
            ) : null}
            <button type="submit" disabled={isSavingManualPrice || manualAssets.length === 0}>
              {isSavingManualPrice ? "Saving..." : "Save manual price"}
            </button>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </div>
        <div className="stack">
          <div className="section-heading">
            <h2>Latest price status</h2>
            <p className="muted">{assets.length} asset records</p>
          </div>
          {isLoading ? <div className="placeholder">Loading prices...</div> : null}
          {!isLoading && assets.length === 0 ? (
            <div className="placeholder">No assets yet. Create assets before pricing them.</div>
          ) : null}
          {!isLoading
            ? assets.map((asset) => {
                const latestPrice = latestPriceByAssetId.get(asset.id);

                return (
                  <article key={asset.id} className="resource-card stack">
                    <div className="section-heading">
                      <div>
                        <h3>{asset.name}</h3>
                        <p className="muted">
                          {formatEnumLabel(asset.priceSourceType)}
                          {asset.symbol ? ` · ${asset.symbol}` : ""}
                        </p>
                      </div>
                      <span>{asset.isActive ? "Active" : "Inactive"}</span>
                    </div>
                    {latestPrice ? (
                      <dl className="detail-grid">
                        <div>
                          <dt>Latest price</dt>
                          <dd>{formatCurrencyAmount(latestPrice.price, latestPrice.currency)}</dd>
                        </div>
                        <div>
                          <dt>Recorded</dt>
                          <dd>{formatDateTime(latestPrice.recordedAt)}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{formatEnumLabel(latestPrice.sourceType)}</dd>
                        </div>
                        <div>
                          <dt>Validity</dt>
                          <dd>{latestPrice.isValid ? "Valid" : "Invalid"}</dd>
                        </div>
                      </dl>
                    ) : (
                      <div className="placeholder">
                        No saved price record yet for this asset.
                      </div>
                    )}
                    {selectedManualAsset?.id === asset.id ? (
                      <p className="muted">
                        Manual entry defaults to this asset&apos;s configured currency.
                      </p>
                    ) : null}
                  </article>
                );
              })
            : null}
        </div>
      </div>
    </section>
  );
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

function formatNullableDateTime(value: string | null) {
  return value ? formatDateTime(value) : "never";
}

function mergeLatestPriceRecord(currentRecords: PriceRecord[], nextRecord: PriceRecord) {
  return [nextRecord, ...currentRecords.filter((record) => record.assetId !== nextRecord.assetId)];
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
