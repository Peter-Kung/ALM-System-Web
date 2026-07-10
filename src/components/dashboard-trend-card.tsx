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

import {
  type DashboardAmountDisplayMode,
  formatDashboardAmount,
} from "@/components/dashboard-amount-format";
import type { DashboardTrendPoint } from "@/modules/dashboard/service";

const TREND_SERIES = [
  { key: "netWorth", label: "Net worth", color: "#7d8f5a" },
  { key: "totalAssets", label: "Total assets", color: "#c79d5c" },
  { key: "totalLiabilities", label: "Total liabilities", color: "#d4684c" },
] as const;

type DashboardTrendCardProps = {
  trendSeries: DashboardTrendPoint[];
  baseCurrency: string;
  amountDisplayMode: DashboardAmountDisplayMode;
};

type TrendDatum = {
  snapshotAt: string;
  shortDate: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
};

export function DashboardTrendCard({
  trendSeries,
  baseCurrency,
  amountDisplayMode,
}: DashboardTrendCardProps) {
  if (trendSeries.length < 2) {
    return null;
  }

  const chartData = trendSeries.map((point) => ({
    snapshotAt: point.snapshotAt,
    shortDate: formatShortDate(point.snapshotAt),
    netWorth: Number(point.netWorth),
    totalAssets: Number(point.totalAssets),
    totalLiabilities: Number(point.totalLiabilities),
  }));
  const latestPoint = chartData[chartData.length - 1];
  const axisLayout = getDashboardTrendAxisLayout(amountDisplayMode);

  return (
    <article className="resource-card stack dashboard-trend-card">
      <div className="section-heading">
        <div>
          <h2>Trend</h2>
          <p className="muted">Saved snapshot history across the latest two or more records.</p>
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
                  formatDashboardAmount(Number(value), baseCurrency, amountDisplayMode)
                }
                width={axisLayout.yAxisWidth}
              />
              <Tooltip
                content={
                  <TrendTooltip
                    baseCurrency={baseCurrency}
                    amountDisplayMode={amountDisplayMode}
                  />
                }
              />
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
                    {formatDashboardAmount(latestPoint[series.key], baseCurrency, amountDisplayMode, {
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
        <caption>Snapshot trend history</caption>
        <thead>
          <tr>
            <th scope="col">Snapshot date</th>
            <th scope="col">Net worth</th>
            <th scope="col">Total assets</th>
            <th scope="col">Total liabilities</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((point) => (
            <tr key={point.snapshotAt}>
              <th scope="row">{point.shortDate}</th>
              <td>{formatDashboardAmount(point.netWorth, baseCurrency, amountDisplayMode)}</td>
              <td>{formatDashboardAmount(point.totalAssets, baseCurrency, amountDisplayMode)}</td>
              <td>
                {formatDashboardAmount(
                  point.totalLiabilities,
                  baseCurrency,
                  amountDisplayMode,
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
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
  amountDisplayMode: DashboardAmountDisplayMode;
};

function TrendTooltip({
  active,
  label,
  payload,
  baseCurrency,
  amountDisplayMode,
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
            {formatDashboardAmount(Number(entry.value ?? 0), baseCurrency, amountDisplayMode)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function getDashboardTrendAxisLayout(mode: DashboardAmountDisplayMode) {
  return mode === "full"
    ? { yAxisWidth: 116, margin: { top: 8, right: 8, left: 8, bottom: 0 } }
    : { yAxisWidth: 72, margin: { top: 8, right: 8, left: -20, bottom: 0 } };
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
