import { Prisma, type SnapshotAccount, type SnapshotHolding, type SnapshotIssue, type SnapshotLiability, type Snapshot } from "@prisma/client";

import { createSnapshotRepository } from "@/modules/snapshots";

type DashboardSnapshot = Snapshot & {
  accounts: SnapshotAccount[];
  holdings: SnapshotHolding[];
  liabilities: SnapshotLiability[];
  issues: SnapshotIssue[];
};

export type DashboardAllocationItem = {
  label: string;
  value: string;
  shareOfAssets: string;
};

export type DashboardRoute = "/manage/snapshots" | "/manage/valuation";

export type DashboardSidebarSummary = {
  hasSnapshot: boolean;
  snapshotAt: string | null;
  netWorth: string | null;
  baseCurrency: string | null;
  status: Snapshot["status"] | null;
  accountCount: number;
  holdingCount: number;
  reminderLabel: string;
};

export type DashboardEmptyState = {
  actionHref: DashboardRoute;
};

export type DashboardHeroSummary = {
  snapshotAt: string;
  status: Snapshot["status"];
  issueCount: number;
  hasTrend: boolean;
  netWorthDirection: "negative" | "flat" | "positive";
};

export type DashboardCoverage = {
  accountCount: number;
  holdingCount: number;
  liabilityCount: number;
  snapshotAt: string;
};

export type DashboardReminders = {
  issueCount: number;
  visibleMessages: string[];
  remainingCount: number;
};

export type DashboardTrendPoint = {
  snapshotAt: string;
  netWorth: string;
  totalAssets: string;
  totalLiabilities: string;
};

export type DashboardTrend = {
  previousSnapshotAt: string;
  netWorthChange: string;
  totalAssetsChange: string;
  totalLiabilitiesChange: string;
  monthlyDebtPaymentChange: string;
};

export type DashboardLatestSnapshot = {
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
  sidebarSummary: DashboardSidebarSummary;
  emptyState: DashboardEmptyState | null;
  heroSummary: DashboardHeroSummary | null;
  latestSnapshot: DashboardLatestSnapshot | null;
  coverage: DashboardCoverage | null;
  reminders: DashboardReminders;
  allocation: DashboardAllocationItem[];
  liabilityBreakdown: DashboardAllocationItem[];
  trend: DashboardTrend | null;
  trendSeries: DashboardTrendPoint[];
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

function buildSidebarSummary(
  latestSnapshot: DashboardLatestSnapshot | null,
  issueMessages: string[],
): DashboardSidebarSummary {
  if (!latestSnapshot) {
    return {
      hasSnapshot: false,
      snapshotAt: null,
      netWorth: null,
      baseCurrency: null,
      status: null,
      accountCount: 0,
      holdingCount: 0,
      reminderLabel: "Run the first valuation preview to populate the workspace pulse.",
    };
  }

  return {
    hasSnapshot: true,
    snapshotAt: latestSnapshot.snapshotAt,
    netWorth: latestSnapshot.netWorth,
    baseCurrency: latestSnapshot.baseCurrency,
    status: latestSnapshot.status,
    accountCount: latestSnapshot.accountCount,
    holdingCount: latestSnapshot.holdingCount,
    reminderLabel:
      issueMessages[0] ??
      `${latestSnapshot.accountCount} accounts and ${latestSnapshot.holdingCount} holdings represented.`,
  };
}

function buildHeroSummary(
  snapshot: DashboardLatestSnapshot,
  hasTrend: boolean,
): DashboardHeroSummary {
  const netWorth = toDecimal(snapshot.netWorth);

  return {
    snapshotAt: snapshot.snapshotAt,
    status: snapshot.status,
    issueCount: snapshot.issueCount,
    hasTrend,
    netWorthDirection: netWorth.lt(0)
      ? "negative"
      : netWorth.eq(0)
        ? "flat"
        : "positive",
  };
}

function buildCoverage(snapshot: DashboardLatestSnapshot): DashboardCoverage {
  return {
    accountCount: snapshot.accountCount,
    holdingCount: snapshot.holdingCount,
    liabilityCount: snapshot.liabilityCount,
    snapshotAt: snapshot.snapshotAt,
  };
}

function buildReminders(issueMessages: string[]): DashboardReminders {
  return {
    issueCount: issueMessages.length,
    visibleMessages: issueMessages.slice(0, 3),
    remainingCount: Math.max(issueMessages.length - 3, 0),
  };
}

function buildTrendSeries(snapshots: DashboardSnapshot[]) {
  if (snapshots.length < 2) {
    return [];
  }

  return [...snapshots]
    .reverse()
    .map((snapshot) => ({
      snapshotAt: toIsoString(snapshot.snapshotAt),
      netWorth: toDecimalString(toDecimal(snapshot.netWorth)),
      totalAssets: toDecimalString(toDecimal(snapshot.totalAssets)),
      totalLiabilities: toDecimalString(toDecimal(snapshot.totalLiabilities)),
    }));
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

const issueSeverityRank: Record<SnapshotIssue["severity"], number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
};

function buildIssueMessages(snapshot: DashboardSnapshot) {
  return [...snapshot.issues]
    .sort((left, right) => {
      const severityDiff = issueSeverityRank[left.severity] - issueSeverityRank[right.severity];

      if (severityDiff !== 0) {
        return severityDiff;
      }

      return left.message.localeCompare(right.message) || left.id.localeCompare(right.id);
    })
    .map((issue) => issue.message);
}

export function buildDashboardSummary(snapshots: DashboardSnapshot[]): DashboardSummary {
  const [latestSnapshot, previousSnapshot] = snapshots;

  if (!latestSnapshot) {
    return {
      sidebarSummary: buildSidebarSummary(null, []),
      emptyState: {
        actionHref: "/manage/valuation",
      },
      heroSummary: null,
      latestSnapshot: null,
      coverage: null,
      reminders: buildReminders([]),
      allocation: [],
      liabilityBreakdown: [],
      trend: null,
      trendSeries: [],
      issueMessages: [],
    };
  }

  const dashboardLatestSnapshot = {
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
  } satisfies DashboardLatestSnapshot;

  const issueMessages = buildIssueMessages(latestSnapshot);

  return {
    sidebarSummary: buildSidebarSummary(dashboardLatestSnapshot, issueMessages),
    emptyState: null,
    heroSummary: buildHeroSummary(
      dashboardLatestSnapshot,
      previousSnapshot != null,
    ),
    latestSnapshot: dashboardLatestSnapshot,
    coverage: buildCoverage(dashboardLatestSnapshot),
    reminders: buildReminders(issueMessages),
    allocation: buildAllocation(latestSnapshot),
    liabilityBreakdown: buildLiabilityBreakdown(latestSnapshot),
    trend: buildTrend(latestSnapshot, previousSnapshot),
    trendSeries: buildTrendSeries(snapshots),
    issueMessages,
  };
}

export async function createDashboardSummaryForUser(userId: string) {
  const snapshots = await snapshotRepository.listByUser(userId, { take: 12 });
  return buildDashboardSummary(snapshots);
}
