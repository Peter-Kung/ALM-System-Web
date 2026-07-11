type ReadOnlyMoneyFormatOptions = {
  currency?: string;
  currencyPosition?: "prefix" | "suffix";
};

export function formatReadOnlyMoneyAmount(value: number | string) {
  const rawValue =
    typeof value === "number" ? formatRawNumber(value) : normalizeRawString(value);
  const numericValue = Number(rawValue);

  if (!Number.isFinite(numericValue)) {
    return rawValue;
  }

  if (Math.abs(numericValue) < 1000) {
    return rawValue;
  }

  return `${formatCompactThousands(numericValue)}K`;
}

export function formatReadOnlyMoney(
  value: number | string,
  options: ReadOnlyMoneyFormatOptions = {},
) {
  const amountLabel = formatReadOnlyMoneyAmount(value);
  const currency = options.currency?.trim();

  if (!currency) {
    return amountLabel;
  }

  if (options.currencyPosition === "prefix") {
    return `${currency} ${amountLabel}`;
  }

  return `${amountLabel} ${currency}`;
}

function formatCompactThousands(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 1000);
}

function formatRawNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  }).format(value);
}

function normalizeRawString(value: string) {
  return value.trim();
}
