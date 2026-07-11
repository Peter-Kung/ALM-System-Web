import { formatReadOnlyMoney } from "@/lib/read-only-money-format";

type DashboardAmountFormatOptions = {
  currencyPosition?: "prefix" | "suffix";
};

export function formatDashboardAmount(
  value: number | string,
  currency: string,
  options: DashboardAmountFormatOptions = {},
) {
  return formatReadOnlyMoney(value, {
    currency,
    currencyPosition: options.currencyPosition,
  });
}
