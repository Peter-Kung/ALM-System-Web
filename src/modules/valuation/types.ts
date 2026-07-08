export const VALUATION_BASE_CURRENCY = "TWD";

export type ValuationPreviewIssue = {
  severity: "INFO" | "WARNING" | "ERROR";
  issueType:
    | "MISSING_PRICE"
    | "MISSING_FX_RATE"
    | "INVALID_PRICE"
    | "INVALID_BALANCE"
    | "DATA_GAP"
    | "OTHER";
  affectedEntityType:
    | "ACCOUNT"
    | "ASSET"
    | "HOLDING"
    | "LIABILITY"
    | "PRICE_RECORD"
    | "SNAPSHOT"
    | "SYSTEM";
  affectedEntityId: string | null;
  message: string;
};

export type ValuationPreviewAccount = {
  sourceAccountId: string;
  accountName: string;
  institutionName: string;
  accountType: string;
  currency: string;
  cashBalance: string;
  cashValue: string;
  holdingsValue: string;
  totalValue: string;
};

export type ValuationPreviewHolding = {
  sourceHoldingId: string;
  sourceAccountId: string;
  sourceAssetId: string;
  accountName: string;
  assetName: string;
  assetType: string;
  symbol: string | null;
  quantity: string;
  assetCurrency: string;
  priceAmount: string | null;
  priceCurrency: string | null;
  priceRecordedAt: string | null;
  fxRateToBase: string | null;
  marketValue: string;
};

export type ValuationPreviewLiability = {
  sourceLiabilityId: string;
  liabilityName: string;
  liabilityType: string;
  currency: string;
  currentBalance: string;
  monthlyPayment: string;
  fxRateToBase: string | null;
  balanceValue: string;
  monthlyPaymentValue: string;
  paymentAccountName: string | null;
};

export type ValuationPreviewInput = {
  generatedAt: string;
  baseCurrency: string;
  fxRates: Array<{
    currency: string;
    rateToBase: string;
  }>;
  accounts: Array<{
    sourceAccountId: string;
    accountName: string;
    institutionName: string;
    accountType: string;
    currency: string;
    cashBalance: string;
  }>;
  holdings: Array<{
    sourceHoldingId: string;
    sourceAccountId: string;
    sourceAssetId: string;
    accountName: string;
    assetName: string;
    assetType: string;
    symbol: string | null;
    quantity: string;
    assetCurrency: string;
    priceAmount: string | null;
    priceCurrency: string | null;
    priceRecordedAt: string | null;
  }>;
  liabilities: Array<{
    sourceLiabilityId: string;
    liabilityName: string;
    liabilityType: string;
    currency: string;
    currentBalance: string;
    monthlyPayment: string;
    paymentAccountName: string | null;
  }>;
};

export type ValuationPreviewResult = {
  status: "COMPLETE" | "INCOMPLETE";
  baseCurrency: string;
  generatedAt: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  cashPosition: string;
  investmentValue: string;
  monthlyDebtPaymentTotal: string;
  accounts: ValuationPreviewAccount[];
  holdings: ValuationPreviewHolding[];
  liabilities: ValuationPreviewLiability[];
  issues: ValuationPreviewIssue[];
  previewInput: ValuationPreviewInput;
  confirmationToken?: string;
};
