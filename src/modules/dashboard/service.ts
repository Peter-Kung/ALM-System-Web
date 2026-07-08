import { Prisma, type SnapshotAccount, type SnapshotHolding, type SnapshotIssue, type SnapshotLiability, type Snapshot } from "@prisma/client";

import { createSnapshotRepository } from "@/modules/snapshots";

type DashboardSnapshot = Snapshot & {
  accounts: SnapshotAccount[];
  holdings: SnapshotHolding[];
  liabilities: SnapshotLiability[];
  issues: SnapshotIssue[];
};

type DashboardAllocationItem = {
  label: string;
  value: string;
  shareOfAssets: string;
};

type DashboardTrend = {
  previousSnapshotAt: string;
  netWorthChange: string;
  totalAssetsChange: string;
  totalLiabilitiesChange: string;
  monthlyDebtPaymentChange: string;
};

type DashboardLatestSnapshot = {
  id: string;
  status: Snapshot["status"];
  baseCurrency: string;
  totalAssets: string;
  totalLiabilities: string;
  netWorth: string;
  cashPosition: string;
  investmentValue: string;
  monthlyDebtPaymentTotal: string;
  snapshotAt: string;
  issueCount: number;
  accountCount: number;
  holdingCount: number;
  liabilityCount: number;
};

export type DashboardSummary = {
  latestSnapshot: DashboardLatestSnapshot | null;
  allocation: DashboardAllocationItem[];
  liabilityBreakdown: DashboardAllocationItem[];
  trend: DashboardTrend | null;
  issueMessages: string[];
};

const snapshotRepository = createSnapshotRepository();

function toDecimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function toDecimalString(value: Prisma.Decimal) {
  return value.toFixed(2);
}

function toIsoString(value: Date) {
  return value.toISOString();
}

function toShareString(value: Prisma.Decimal, total: Prisma.Decimal) {
  if (total.lte(0)) {
    return "0.00";
  }

  return value.mul(100).div(total).toFixed(2);
}

function groupAllocationItems(
  totals: Map<string, Prisma.Decimal>,
  totalAssets: Prisma.Decimal,
) {
  return [...totals.entries()]
    .sort((left, right) => right[1].cmp(left[1]))
    .map(([label, value]) => ({
      label,
      value: toDecimalString(value),
      shareOfAssets: toShareString(value, totalAssets),
    }));
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function buildAllocation(snapshot: DashboardSnapshot) {
  const totalAssets = toDecimal(snapshot.totalAssets);
  const totals = new Map<string, Prisma.Decimal>();

  if (toDecimal(snapshot.cashPosition).gt(0)) {
    totals.set("Cash", toDecimal(snapshot.cashPosition));
  }

  for (const holding of snapshot.holdings) {
    const label = formatEnumLabel(holding.assetType);
    const nextValue = (totals.get(label) ?? toDecimal(0)).add(holding.marketValue);
    totals.set(label, nextValue);
  }

  return groupAllocationItems(totals, totalAssets);
}

function buildLiabilityBreakdown(snapshot: DashboardSnapshot) {
  const totalLiabilities = toDecimal(snapshot.totalLiabilities);
  const totals = new Map<string, Prisma.Decimal>();

  for (const liability of snapshot.liabilities) {
    const label = formatEnumLabel(liability.liabilityType);
    const nextValue = (totals.get(label) ?? toDecimal(0)).add(liability.balanceValue);
    totals.set(label, nextValue);
  }

  return groupAllocationItems(totals, totalLiabilities);
}

function buildTrend(
  latestSnapshot: DashboardSnapshot,
  previousSnapshot: DashboardSnapshot | undefined,
) {
  if (!previousSnapshot) {
    return null;
  }

  return {
    previousSnapshotAt: toIsoString(previousSnapshot.snapshotAt),
    netWorthChange: toDecimalString(
      toDecimal(latestSnapshot.netWorth).sub(previousSnapshot.netWorth),
    ),
    totalAssetsChange: toDecimalString(
      toDecimal(latestSnapshot.totalAssets).sub(previousSnapshot.totalAssets),
    ),
    totalLiabilitiesChange: toDecimalString(
      toDecimal(latestSnapshot.totalLiabilities).sub(previousSnapshot.totalLiabilities),
    ),
    monthlyDebtPaymentChange: toDecimalString(
      toDecimal(latestSnapshot.monthlyDebtPaymentTotal).sub(
        previousSnapshot.monthlyDebtPaymentTotal,
      ),
    ),
  };
}

export function buildDashboardSummary(snapshots: DashboardSnapshot[]): DashboardSummary {
  const [latestSnapshot, previousSnapshot] = snapshots;

  if (!latestSnapshot) {
    return {
      latestSnapshot: null,
      allocation: [],
      liabilityBreakdown: [],
      trend: null,
      issueMessages: [],
    };
  }

  return {
    latestSnapshot: {
      id: latestSnapshot.id,
      status: latestSnapshot.status,
      baseCurrency: latestSnapshot.baseCurrency,
      totalAssets: toDecimalString(toDecimal(latestSnapshot.totalAssets)),
      totalLiabilities: toDecimalString(toDecimal(latestSnapshot.totalLiabilities)),
      netWorth: toDecimalString(toDecimal(latestSnapshot.netWorth)),
      cashPosition: toDecimalString(toDecimal(latestSnapshot.cashPosition)),
      investmentValue: toDecimalString(toDecimal(latestSnapshot.investmentValue)),
      monthlyDebtPaymentTotal: toDecimalString(
        toDecimal(latestSnapshot.monthlyDebtPaymentTotal),
      ),
      snapshotAt: toIsoString(latestSnapshot.snapshotAt),
      issueCount: latestSnapshot.issues.length,
      accountCount: latestSnapshot.accounts.length,
      holdingCount: latestSnapshot.holdings.length,
      liabilityCount: latestSnapshot.liabilities.length,
    },
    allocation: buildAllocation(latestSnapshot),
    liabilityBreakdown: buildLiabilityBreakdown(latestSnapshot),
    trend: buildTrend(latestSnapshot, previousSnapshot),
    issueMessages: latestSnapshot.issues.map((issue) => issue.message),
  };
}

export async function createDashboardSummaryForUser(userId: string) {
  const snapshots = await snapshotRepository.listByUser(userId, { take: 2 });
  return buildDashboardSummary(snapshots);
}
