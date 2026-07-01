"use client";
// ─── Sparkline ────────────────────────────────────────────────────────────────
// S — Single Responsibility: mini inline trend line for KPI tiles
import { LineChart, Line, ResponsiveContainer } from "recharts";
import type { TimeSeriesPoint } from "@/types/ui.types";

interface SparklineProps {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
  className?: string;
}

export function Sparkline({
  data,
  color = "#3b82f6",
  height = 32,
  className = "",
}: SparklineProps) {
  const heightStyle = typeof height === "number" ? `${height}px` : height;
  if (!data.length)
    return <div style={{ height: heightStyle }} className={className} />;
  return (
    <div
      style={{ height: heightStyle, minWidth: 0, minHeight: heightStyle }}
      className={className}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
