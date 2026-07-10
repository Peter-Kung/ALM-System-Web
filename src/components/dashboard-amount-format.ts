export type DashboardAmountDisplayMode = "compact" | "full";

type DashboardAmountFormatOptions = {
  currencyPosition?: "prefix" | "suffix";
};

export const DASHBOARD_AMOUNT_DISPLAY_STORAGE_KEY = "alm.dashboard.amountDisplay";

export function readDashboardAmountDisplayMode(
  storage: Storage | undefined,
): DashboardAmountDisplayMode {
  if (!storage) {
    return "compact";
  }

  return storage.getItem(DASHBOARD_AMOUNT_DISPLAY_STORAGE_KEY) === "full"
    ? "full"
    : "compact";
}

export function formatDashboardAmount(
  value: number | string,
  currency: string,
  mode: DashboardAmountDisplayMode,
  options: DashboardAmountFormatOptions = {},
) {
  const amount = typeof value === "number" ? value : Number(value);
  const label =
    mode === "compact" && Math.abs(amount) >= 1000
      ? formatCompactThousands(amount)
      : formatFullAmount(amount);

  if (options.currencyPosition === "prefix") {
    return `${currency} ${label}`;
  }

  return `${label} ${currency}`;
}

function formatFullAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCompactThousands(value: number) {
  const compactValue = value / 1000;

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(compactValue)}K`;
}
