"use client";

import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDashboardAmount } from "@/components/dashboard-amount-format";
import type { DashboardTrend } from "@/modules/dashboard/service";

const TREND_SERIES = [
  { key: "netWorth", label: "Net worth", color: "#556b3d" },
  { key: "totalAssets", label: "Assets", color: "#b8843f" },
  { key: "totalLiabilities", label: "Liabilities", color: "#bd5a45" },
  { key: "monthlyDebtPaymentTotal", label: "Monthly debt payments", color: "#4f7f91" },
] as const;

type DashboardTrendCardProps = {
  trend: DashboardTrend | null;
  baseCurrency: string;
};

type DashboardTrendCardDependencies = {
  fetcher: typeof fetch;
  replaceHistory: (selectedDate: string) => void;
};

type TrendDatum = {
  date: string;
  shortDate: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyDebtPaymentTotal: number;
};

export function DashboardTrendCard({
  trend,
  baseCurrency,
}: DashboardTrendCardProps) {
  return (
    <DashboardTrendCardWithDependencies
      trend={trend}
      baseCurrency={baseCurrency}
      fetcher={globalThis.fetch}
      replaceHistory={replaceDashboardTrendHistory}
    />
  );
}

export function DashboardTrendCardWithDependencies({
  trend,
  baseCurrency,
  fetcher,
  replaceHistory,
}: DashboardTrendCardProps & DashboardTrendCardDependencies) {
  const [currentTrend, setCurrentTrend] = React.useState(trend);
  const [selectedDateInput, setSelectedDateInput] = React.useState(trend?.selectedDate ?? "");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const requestIdRef = React.useRef(0);
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setCurrentTrend(trend);
    setSelectedDateInput(trend?.selectedDate ?? "");
    setErrorMessage(null);
  }, [trend]);

  const loadTrend = React.useCallback(
    async (value: string) => {
      if (!currentTrend || !value || value === currentTrend.selectedDate) {
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setSelectedDateInput(value);
      setErrorMessage(null);

      try {
        const response = await fetcher(
          `/api/dashboard/trend?trendDate=${encodeURIComponent(value)}`,
        );

        if (!response.ok) {
          throw new Error("Trend request failed.");
        }

        const payload = (await response.json()) as { trend: DashboardTrend | null };

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!payload.trend) {
          setSelectedDateInput(currentTrend.selectedDate);
          setErrorMessage("Unable to update the selected trend date right now.");
          return;
        }

        const nextTrend = payload.trend;

        startTransition(() => {
          setCurrentTrend(nextTrend);
          setSelectedDateInput(nextTrend.selectedDate);
          replaceHistory(nextTrend.selectedDate);
        });
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }

        setSelectedDateInput(currentTrend.selectedDate);
        setErrorMessage("Unable to update the selected trend date right now.");
      }
    },
    [currentTrend, fetcher, replaceHistory],
  );

  if (!currentTrend || currentTrend.visiblePoints.length === 0) {
    return null;
  }

  const chartData = currentTrend.visiblePoints.map((point) => ({
    date: point.date,
    shortDate: formatShortDate(point.date),
    netWorth: Number(point.netWorth),
    totalAssets: Number(point.totalAssets),
    totalLiabilities: Number(point.totalLiabilities),
    monthlyDebtPaymentTotal: Number(point.monthlyDebtPaymentTotal),
  }));
  const latestPoint = chartData[chartData.length - 1];
  const axisLayout = getDashboardTrendAxisLayout();
  const previousDate = currentTrend.previousDate;
  const nextDate =
    currentTrend.selectedDate < currentTrend.latestSelectableDate
      ? addUtcCalendarDays(currentTrend.selectedDate, 1)
      : null;
  const selectedShortDate = formatShortDate(currentTrend.selectedDate);
  const latestShortDate = formatShortDate(currentTrend.latestSelectableDate);

  return (
    <article className="resource-card stack dashboard-trend-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Trend summary</p>
          <h2>Daily line trend</h2>
          <p className="muted">
            {selectedShortDate} to {latestShortDate}, with missing days carried forward.
          </p>
        </div>
        <div className="dashboard-trend-controls" aria-label="Trend date controls">
          <TrendDateButton
            direction="previous"
            pending={isPending}
            targetDate={previousDate}
            onSelect={loadTrend}
          />
          <label className="dashboard-date-picker">
            <span className="visually-hidden">Trend start date</span>
            <input
              type="date"
              name="trendDate"
              min={currentTrend.firstSelectableDate}
              max={currentTrend.latestSelectableDate}
              value={selectedDateInput}
              disabled={isPending}
              onInput={(event) => {
                void loadTrend(event.currentTarget.value);
              }}
            />
          </label>
          <TrendDateButton
            direction="next"
            pending={isPending}
            targetDate={nextDate}
            onSelect={loadTrend}
          />
        </div>
      </div>
      {errorMessage ? (
        <p className="muted" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="dashboard-trend-layout">
        <div className="dashboard-trend-chart">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={axisLayout.margin}>
              <CartesianGrid stroke="rgba(107, 111, 103, 0.16)" vertical={false} />
              <XAxis
                dataKey="shortDate"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#5b6157", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#5b6157", fontSize: 12 }}
                tickFormatter={(value: number | string) =>
                  formatDashboardAmount(Number(value), baseCurrency)
                }
                width={axisLayout.yAxisWidth}
              />
              <Tooltip content={<TrendTooltip baseCurrency={baseCurrency} />} />
              {TREND_SERIES.map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  name={series.label}
                  stroke={series.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: series.color }}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <ul className="dashboard-trend-key" aria-label="Trend series">
          {TREND_SERIES.map((series) => (
            <li key={series.key} className="dashboard-trend-key-item">
              <span
                className="dashboard-trend-swatch"
                style={{ backgroundColor: series.color }}
                aria-hidden="true"
              />
              <div className="stack">
                <div className="dashboard-trend-key-row">
                  <strong>{series.label}</strong>
                  <span>
                    {formatDashboardAmount(latestPoint[series.key], baseCurrency, {
                      currencyPosition: "prefix",
                    })}
                  </span>
                </div>
                <span className="muted">
                  {chartData[0].shortDate} to {latestPoint.shortDate}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <table className="visually-hidden">
        <caption>Daily trend history</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Net worth</th>
            <th scope="col">Assets</th>
            <th scope="col">Liabilities</th>
            <th scope="col">Monthly debt payments</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((point) => (
            <tr key={point.date}>
              <th scope="row">{point.shortDate}</th>
              <td>{formatDashboardAmount(point.netWorth, baseCurrency)}</td>
              <td>{formatDashboardAmount(point.totalAssets, baseCurrency)}</td>
              <td>{formatDashboardAmount(point.totalLiabilities, baseCurrency)}</td>
              <td>{formatDashboardAmount(point.monthlyDebtPaymentTotal, baseCurrency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

type TrendDateButtonProps = {
  direction: "previous" | "next";
  onSelect: (value: string) => Promise<void>;
  pending: boolean;
  targetDate: string | null;
};

function TrendDateButton({
  direction,
  onSelect,
  pending,
  targetDate,
}: TrendDateButtonProps) {
  const label = direction === "previous" ? "Previous day" : "Next day";
  const icon = direction === "previous" ? "<" : ">";

  return (
    <button
      type="button"
      className="dashboard-trend-arrow"
      disabled={!targetDate || pending}
      aria-label={label}
      onClick={() => {
        if (targetDate) {
          void onSelect(targetDate);
        }
      }}
    >
      {icon}
    </button>
  );
}

type TrendTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: Array<{
    name?: string;
    value?: number | string;
  }>;
  baseCurrency: string;
};

function TrendTooltip({
  active,
  label,
  payload,
  baseCurrency,
}: TrendTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="dashboard-allocation-tooltip">
      <strong>{label}</strong>
      <div className="stack">
        {payload.map((entry) => (
          <span key={entry.name}>
            {entry.name}: {formatDashboardAmount(Number(entry.value ?? 0), baseCurrency)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function getDashboardTrendAxisLayout() {
  return { yAxisWidth: 72, margin: { top: 8, right: 8, left: -20, bottom: 0 } };
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function addUtcCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function replaceDashboardTrendHistory(value: string) {
  if (!value) {
    return;
  }

  const url = new URL("/dashboard", globalThis.location?.origin ?? "http://localhost");
  url.searchParams.set("trendDate", value);
  const history = globalThis.history ?? globalThis.window?.history;
  history?.replaceState?.(null, "", `${url.pathname}${url.search}`);
}
