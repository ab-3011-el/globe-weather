"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface ChartPoint {
  name: string;
  value: number;
}

interface WeatherChartProps {
  data: ChartPoint[];
}

export default function WeatherChart({
  data,
}: WeatherChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 8,
            left: -10,
            bottom: 0,
          }}
        >
          <CartesianGrid
            stroke="rgba(148,163,184,0.10)"
            strokeDasharray="4 4"
          />

          <XAxis
            dataKey="name"
            tick={{
              fill: "#94a3b8",
              fontSize: 12,
              fontWeight: 500,
            }}
            axisLine={{
              stroke: "rgba(148,163,184,0.25)",
            }}
            tickLine={false}
          />

          <YAxis
            tick={{
              fill: "#94a3b8",
              fontSize: 12,
              fontWeight: 500,
            }}
            axisLine={{
              stroke: "rgba(148,163,184,0.25)",
            }}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              background:
                "rgba(15,23,42,0.96)",
              border:
                "1px solid rgba(148,163,184,0.16)",
              borderRadius: "14px",
              color: "#fff",
              boxShadow:
                "0 15px 40px rgba(0,0,0,0.35)",
            }}
            labelStyle={{
              color: "#94a3b8",
              fontSize: 12,
              marginBottom: 4,
            }}
            itemStyle={{
              color: "#38bdf8",
              fontWeight: 700,
            }}
            cursor={{
              stroke:
                "rgba(56,189,248,0.25)",
            }}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="#38bdf8"
            strokeWidth={3}
            dot={{
              r: 6,
              fill: "#38bdf8",
              stroke: "#38bdf8",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 8,
              fill: "#67e8f9",
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}