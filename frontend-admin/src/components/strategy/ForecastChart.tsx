'use client';

/**
 * ForecastChart.tsx — Recharts AreaChart for revenue/cost/margin projection
 *
 * S: chart rendering only; receives data as props
 * L: ForecastPoint contract kept stable; easy to swap chart library
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ForecastPoint } from '@/types/strategy.types';

interface Props {
  points: ForecastPoint[];
}

const fmt = (v: number) => `$${(v / 1_000).toFixed(0)}k`;

export function ForecastChart({ points }: Props) {
  if (!points.length) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 text-sm">
        Run a forecast to see projection
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={points} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="month"
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={fmt}
          tick={{ fill: '#71717a', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={48}
        />
        <Tooltip
          contentStyle={{
            background: '#18181b',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#d4d4d8', marginBottom: 4 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [typeof value === 'number' ? fmt(value as number) : String(value ?? '')]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#6366f1"
          fill="url(#gradRevenue)"
          strokeWidth={2}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="cost"
          name="Cost"
          stroke="#ef4444"
          fill="url(#gradCost)"
          strokeWidth={2}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="margin"
          name="Margin"
          stroke="#22c55e"
          fill="url(#gradMargin)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
