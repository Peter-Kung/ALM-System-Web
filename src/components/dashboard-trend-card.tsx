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
import type { DashboardTrend, DashboardTrendPoint } from "@/modules/dashboard/service";

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
  if (!trend || trend.visiblePoints.length === 0) {
    return null;
  }

  const chartData = trend.visiblePoints.map((point) => ({
    date: point.date,
    shortDate: formatShortDate(point.date),
    netWorth: Number(point.netWorth),
    totalAssets: Number(point.totalAssets),
    totalLiabilities: Number(point.totalLiabilities),
    monthlyDebtPaymentTotal: Number(point.monthlyDebtPaymentTotal),
  }));
  const latestPoint = chartData[chartData.length - 1];
  const axisLayout = getDashboardTrendAxisLayout();
  const previousDate = trend.previousDate;
  const nextDate =
    trend.selectedDate < trend.latestSelectableDate
      ? addUtcCalendarDays(trend.selectedDate, 1)
      : null;
  const selectedShortDate = formatShortDate(trend.selectedDate);
  const latestShortDate = formatShortDate(trend.latestSelectableDate);

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
          <TrendDateButton direction="previous" targetDate={previousDate} />
          <label className="dashboard-date-picker">
            <span className="visually-hidden">Trend start date</span>
            <input
              type="date"
              name="trendDate"
              min={trend.firstSelectableDate}
              max={trend.latestSelectableDate}
              defaultValue={trend.selectedDate}
              onChange={(event) => navigateToTrendDate(event.currentTarget.value)}
            />
          </label>
          <TrendDateButton direction="next" targetDate={nextDate} />
        </div>
      </div>

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
  targetDate: string | null;
};

function TrendDateButton({ direction, targetDate }: TrendDateButtonProps) {
  const label = direction === "previous" ? "Previous day" : "Next day";
  const icon = direction === "previous" ? "<" : ">";

  return (
    <button
      type="button"
      className="dashboard-trend-arrow"
      disabled={!targetDate}
      aria-label={label}
      onClick={() => {
        if (targetDate) {
          navigateToTrendDate(targetDate);
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
            {entry.name}:{" "}
            {formatDashboardAmount(Number(entry.value ?? 0), baseCurrency)}
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

function navigateToTrendDate(value: string) {
  if (!value) {
    return;
  }

  const url = new URL("/dashboard", globalThis.location?.origin ?? "http://localhost");
  url.searchParams.set("trendDate", value);
  globalThis.location.assign(`${url.pathname}${url.search}`);
}
