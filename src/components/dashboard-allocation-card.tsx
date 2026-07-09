"use client";

import React from "react";
import {
  Cell,
  Pie,
  PieChart,
  Tooltip,
} from "recharts";

import type { DashboardAllocationItem } from "@/modules/dashboard/service";

const ALLOCATION_COLORS = [
  "#7d8f5a",
  "#c79d5c",
  "#d4684c",
  "#6f8f96",
  "#9c7f6b",
];

type DashboardAllocationCardProps = {
  allocation: DashboardAllocationItem[];
  baseCurrency: string;
};

export function DashboardAllocationCard({
  allocation,
  baseCurrency,
}: DashboardAllocationCardProps) {
  if (allocation.length === 0) {
    return (
      <article className="resource-card stack dashboard-allocation-card">
        <div className="section-heading">
          <div>
            <h2>Allocation</h2>
            <p className="muted">Latest snapshot assets grouped by category.</p>
          </div>
        </div>
        <p className="muted">No allocation data is available in the latest snapshot.</p>
      </article>
    );
  }

  const chartData = allocation.map((item) => ({
    ...item,
    numericValue: Number(item.value),
  }));

  return (
    <article className="resource-card stack dashboard-allocation-card">
      <div className="section-heading">
        <div>
          <h2>Allocation</h2>
          <p className="muted">Latest snapshot assets grouped by category.</p>
        </div>
      </div>

      <div className="dashboard-allocation-layout">
        <div className="dashboard-allocation-chart" aria-hidden="true">
          <PieChart width={240} height={240}>
            <Pie
              data={chartData}
              dataKey="numericValue"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="rgba(250, 247, 241, 0.95)"
              strokeWidth={3}
            >
              {chartData.map((item, index) => (
                <Cell
                  key={item.label}
                  fill={ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<AllocationTooltip baseCurrency={baseCurrency} />} />
          </PieChart>
        </div>

        <ul className="dashboard-allocation-legend" aria-label="Allocation legend">
          {allocation.map((item, index) => (
            <li key={item.label} className="dashboard-allocation-legend-item">
              <span
                className="dashboard-allocation-swatch"
                style={{
                  backgroundColor: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
                }}
                aria-hidden="true"
              />
              <div className="stack">
                <div className="dashboard-allocation-legend-row">
                  <strong>{item.label}</strong>
                  <span>
                    {baseCurrency} {formatMoneyLabel(Number(item.value))}
                  </span>
                </div>
                <span className="muted">{item.shareOfAssets}% of assets</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function formatMoneyLabel(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type AllocationTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    payload?: {
      label?: string;
      shareOfAssets?: string;
    };
  }>;
  baseCurrency: string;
};

function AllocationTooltip({
  active,
  payload,
  baseCurrency,
}: AllocationTooltipProps) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const entry = payload[0];
  const amount = Number(entry.value ?? 0);
  const label = entry.payload?.label ?? "Allocation";
  const share = entry.payload?.shareOfAssets ?? "0.00";

  return (
    <div className="dashboard-allocation-tooltip">
      <strong>{label}</strong>
      <div>
        {baseCurrency} {formatMoneyLabel(amount)} · {share}%
      </div>
    </div>
  );
}
