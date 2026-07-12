import { Prisma, type SnapshotAccount, type SnapshotHolding, type SnapshotIssue, type SnapshotLiability, type Snapshot } from "@prisma/client";

import { createSnapshotRepository, type SnapshotTrendRecord } from "@/modules/snapshots";

type DashboardSnapshot = Snapshot & {
  accounts: SnapshotAccount[];
  holdings: SnapshotHolding[];
  liabilities: SnapshotLiability[];
  issues: SnapshotIssue[];
};

type DashboardTrendSnapshot =
  | Pick<
      DashboardSnapshot,
      | "id"
      | "snapshotAt"
      | "createdAt"
      | "netWorth"
      | "totalAssets"
      | "totalLiabilities"
      | "monthlyDebtPaymentTotal"
    >
  | SnapshotTrendRecord;

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
  cashPosition: string | null;
  investmentValue: string | null;
  totalLiabilities: string | null;
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
  date: string;
  snapshotAt: string;
  netWorth: string;
  totalAssets: string;
  totalLiabilities: string;
  monthlyDebtPaymentTotal: string;
};

export type DashboardTrend = {
  firstSelectableDate: string;
  latestSelectableDate: string;
  defaultSelectedDate: string;
  selectedDate: string;
  previousDate: string | null;
  netWorthChange: string;
  totalAssetsChange: string;
  totalLiabilitiesChange: string;
  monthlyDebtPaymentChange: string;
  visiblePoints: DashboardTrendPoint[];
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

export type DashboardSummaryOptions = {
  selectedDate?: string | null;
};

const snapshotRepository = createSnapshotRepository();
const DASHBOARD_TREND_HISTORY_DAYS = 370;
const DASHBOARD_TREND_SERIES_DAYS = 10;

type DashboardRepositories = {
  snapshotRepository: {
    listByUser(
      userId: string,
      options?: { take?: number },
    ): PromiseLike<DashboardSnapshot[]>;
    listTrendByUser(
      userId: string,
      options?: { since?: Date },
    ): PromiseLike<DashboardTrendSnapshot[]>;
  };
};

const defaultDashboardRepositories = {
  snapshotRepository,
} satisfies DashboardRepositories;

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
      cashPosition: null,
      investmentValue: null,
      totalLiabilities: null,
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
    cashPosition: latestSnapshot.cashPosition,
    investmentValue: latestSnapshot.investmentValue,
    totalLiabilities: latestSnapshot.totalLiabilities,
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

function toDateKey(value: Date) {
  return toIsoString(value).slice(0, 10);
}

function addUtcDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function compareSnapshotsByTime(
  left: DashboardTrendSnapshot,
  right: DashboardTrendSnapshot,
) {
  const snapshotTimeDiff = left.snapshotAt.getTime() - right.snapshotAt.getTime();

  if (snapshotTimeDiff !== 0) {
    return snapshotTimeDiff;
  }

  const createdTimeDiff = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdTimeDiff !== 0) {
    return createdTimeDiff;
  }

  return left.id.localeCompare(right.id);
}

function buildTrendPoint(date: string, snapshot: DashboardTrendSnapshot): DashboardTrendPoint {
  return {
    date,
    snapshotAt: toIsoString(snapshot.snapshotAt),
    netWorth: toDecimalString(toDecimal(snapshot.netWorth)),
    totalAssets: toDecimalString(toDecimal(snapshot.totalAssets)),
    totalLiabilities: toDecimalString(toDecimal(snapshot.totalLiabilities)),
    monthlyDebtPaymentTotal: toDecimalString(toDecimal(snapshot.monthlyDebtPaymentTotal)),
  };
}

function buildDailyTrendPoints(snapshots: DashboardTrendSnapshot[]) {
  const snapshotsByDate = new Map<string, DashboardTrendSnapshot>();

  for (const snapshot of snapshots) {
    const dateKey = toDateKey(snapshot.snapshotAt);
    const current = snapshotsByDate.get(dateKey);

    if (!current || compareSnapshotsByTime(current, snapshot) < 0) {
      snapshotsByDate.set(dateKey, snapshot);
    }
  }

  const snapshotDates = [...snapshotsByDate.keys()].sort();

  if (snapshotDates.length < 2) {
    return [];
  }

  const firstDate = snapshotDates[0];
  const latestDate = snapshotDates[snapshotDates.length - 1];
  const points: DashboardTrendPoint[] = [];
  let currentSnapshot: DashboardTrendSnapshot | undefined;

  for (let date = firstDate; date <= latestDate; date = addUtcDays(date, 1)) {
    currentSnapshot = snapshotsByDate.get(date) ?? currentSnapshot;

    if (currentSnapshot) {
      points.push(buildTrendPoint(date, currentSnapshot));
    }
  }

  return points;
}

function normalizeSelectedDate(
  selectedDate: string | null | undefined,
  firstSelectableDate: string,
  latestSelectableDate: string,
) {
  if (!selectedDate || !isValidDateKey(selectedDate)) {
    return latestSelectableDate;
  }

  if (selectedDate < firstSelectableDate) {
    return firstSelectableDate;
  }

  if (selectedDate > latestSelectableDate) {
    return latestSelectableDate;
  }

  return selectedDate;
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function buildTrend(
  dailyPoints: DashboardTrendPoint[],
  options: DashboardSummaryOptions,
) {
  if (dailyPoints.length < 2) {
    return null;
  }

  const firstSelectableDate = dailyPoints[0].date;
  const latestSelectableDate = dailyPoints[dailyPoints.length - 1].date;
  const selectedDate = normalizeSelectedDate(
    options.selectedDate,
    firstSelectableDate,
    latestSelectableDate,
  );
  const selectedIndex = dailyPoints.findIndex((point) => point.date === selectedDate);
  const previousPoint = selectedIndex > 0 ? dailyPoints[selectedIndex - 1] : null;
  const selectedPoint = dailyPoints[selectedIndex];
  const lastVisibleDate = addUtcDays(selectedDate, 9);
  const visiblePoints = dailyPoints.filter(
    (point) => point.date >= selectedDate && point.date <= lastVisibleDate,
  );

  return {
    firstSelectableDate,
    latestSelectableDate,
    defaultSelectedDate: latestSelectableDate,
    selectedDate,
    previousDate: previousPoint?.date ?? null,
    netWorthChange: toDecimalString(
      toDecimal(selectedPoint.netWorth).sub(previousPoint?.netWorth ?? selectedPoint.netWorth),
    ),
    totalAssetsChange: toDecimalString(
      toDecimal(selectedPoint.totalAssets).sub(previousPoint?.totalAssets ?? selectedPoint.totalAssets),
    ),
    totalLiabilitiesChange: toDecimalString(
      toDecimal(selectedPoint.totalLiabilities).sub(
        previousPoint?.totalLiabilities ?? selectedPoint.totalLiabilities,
      ),
    ),
    monthlyDebtPaymentChange: toDecimalString(
      toDecimal(selectedPoint.monthlyDebtPaymentTotal).sub(
        previousPoint?.monthlyDebtPaymentTotal ?? selectedPoint.monthlyDebtPaymentTotal,
      ),
    ),
    visiblePoints,
  };
}

function buildDefaultTrendSeries(dailyPoints: DashboardTrendPoint[]) {
  return dailyPoints.slice(-DASHBOARD_TREND_SERIES_DAYS);
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

function buildDashboardSummaryFromParts(
  latestSnapshot: DashboardSnapshot | undefined,
  trendSnapshots: DashboardTrendSnapshot[],
  options: DashboardSummaryOptions = {},
): DashboardSummary {
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
  const dailyTrendPoints = buildDailyTrendPoints(trendSnapshots);
  const trend = buildTrend(dailyTrendPoints, options);
  const trendSeries = buildDefaultTrendSeries(dailyTrendPoints);

  return {
    sidebarSummary: buildSidebarSummary(dashboardLatestSnapshot, issueMessages),
    emptyState: null,
    heroSummary: buildHeroSummary(
      dashboardLatestSnapshot,
      trend != null,
    ),
    latestSnapshot: dashboardLatestSnapshot,
    coverage: buildCoverage(dashboardLatestSnapshot),
    reminders: buildReminders(issueMessages),
    allocation: buildAllocation(latestSnapshot),
    liabilityBreakdown: buildLiabilityBreakdown(latestSnapshot),
    trend,
    trendSeries,
    issueMessages,
  };
}

export function buildDashboardSummary(
  snapshots: DashboardSnapshot[],
  options: DashboardSummaryOptions = {},
): DashboardSummary {
  return buildDashboardSummaryFromParts(snapshots[0], snapshots, options);
}

export async function createDashboardSummaryForUser(
  userId: string,
  options: DashboardSummaryOptions = {},
  repositories: DashboardRepositories = defaultDashboardRepositories,
) {
  const [latestSnapshot] = await repositories.snapshotRepository.listByUser(userId, {
    take: 1,
  });

  if (!latestSnapshot) {
    return buildDashboardSummaryFromParts(undefined, [], options);
  }

  const trendSince = new Date(
    `${addUtcDays(
      toDateKey(latestSnapshot.snapshotAt),
      -(DASHBOARD_TREND_HISTORY_DAYS - 1),
    )}T00:00:00.000Z`,
  );
  const trendSnapshots = await repositories.snapshotRepository.listTrendByUser(userId, {
    since: trendSince,
  });

  return buildDashboardSummaryFromParts(latestSnapshot, trendSnapshots, options);
}

export async function createDashboardTrendForUser(
  userId: string,
  options: DashboardSummaryOptions = {},
  repositories: DashboardRepositories = defaultDashboardRepositories,
) {
  const [latestSnapshot] = await repositories.snapshotRepository.listByUser(userId, {
    take: 1,
  });

  if (!latestSnapshot) {
    return null;
  }

  const trendSince = new Date(
    `${addUtcDays(
      toDateKey(latestSnapshot.snapshotAt),
      -(DASHBOARD_TREND_HISTORY_DAYS - 1),
    )}T00:00:00.000Z`,
  );
  const trendSnapshots = await repositories.snapshotRepository.listTrendByUser(userId, {
    since: trendSince,
  });

  return buildTrend(buildDailyTrendPoints(trendSnapshots), options);
}
