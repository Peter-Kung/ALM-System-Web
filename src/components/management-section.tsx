"use client";

import {
  AccountType,
  AssetPriceSourceType,
  AssetType,
  LiabilityType,
} from "@prisma/client";
import { FormEvent, useEffect, useState } from "react";

import { ValuationManager } from "@/components/valuation-manager";

type AccountRecord = {
  id: string;
  name: string;
  institutionName: string;
  accountType: AccountType;
  currency: string;
  cashBalance: string;
  isActive: boolean;
  notes: string | null;
};

type AssetRecord = {
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

function AccountsManager() {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [form, setForm] = useState<AccountFormState>(emptyAccountForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
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

  return (
    <section className="stack">
      <div className="hero stack">
        <p className="eyebrow">Account management</p>
        <h1>Accounts</h1>
        <p className="muted">
          Maintain cash, bank, and brokerage accounts with current balances and
          active status.
        </p>
      </div>
      <div className="management-grid">
        <form className="card stack" onSubmit={handleSubmit}>
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
        <div className="stack">
          <div className="section-heading">
            <h2>Existing accounts</h2>
            <p className="muted">{accounts.length} account records</p>
          </div>
          {isLoading ? <div className="placeholder">Loading accounts...</div> : null}
          {!isLoading && accounts.length === 0 ? (
            <div className="placeholder">No accounts yet. Create the first account.</div>
          ) : null}
          {accounts.map((account) => (
            <article key={account.id} className="resource-card stack">
              <div className="section-heading">
                <div>
                  <h3>{account.name}</h3>
                  <p className="muted">
                    {account.institutionName} · {formatEnumLabel(account.accountType)}
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-button compact-button"
                  onClick={() => beginEdit(account)}
                >
                  Edit
                </button>
              </div>
              <dl className="detail-grid">
                <div>
                  <dt>Currency</dt>
                  <dd>{account.currency}</dd>
                </div>
                <div>
                  <dt>Cash balance</dt>
                  <dd>{account.cashBalance}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{account.isActive ? "Active" : "Inactive"}</dd>
                </div>
              </dl>
              {account.notes ? <p className="muted">{account.notes}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AssetsManager() {
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
            <article key={asset.id} className="resource-card stack">
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
                  className="ghost-button compact-button"
                  onClick={() => beginEdit(asset)}
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
          ))}
        </div>
      </div>
    </section>
  );
}

function HoldingsManager() {
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
        account: accounts.find((account) => account.id === payload.holding?.accountId) ?? payload.holding.account,
        asset: assets.find((asset) => asset.id === payload.holding?.assetId) ?? payload.holding.asset,
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
        <form className="card stack" onSubmit={handleSubmit}>
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
                  <dd>{liability.currentBalance}</dd>
                </div>
                <div>
                  <dt>Monthly payment</dt>
                  <dd>{liability.monthlyPayment}</dd>
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
  }

  async function handleRefresh() {
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
      setError(refreshError instanceof Error ? refreshError.message : "Failed to refresh prices.");
    } finally {
      setIsRefreshing(false);
    }
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
        <div className="stack">
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
                      <strong>
                        {entry.price} {entry.currency}
                      </strong>
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
                          <dd>
                            {latestPrice.price} {latestPrice.currency}
                          </dd>
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
