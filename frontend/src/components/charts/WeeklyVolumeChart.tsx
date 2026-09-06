import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTheme } from "../../context/ThemeContext";
import type { VolumePoint } from "../../types";

export default function WeeklyVolumeChart({ data }: { data: VolumePoint[] }) {
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#334155" : "#e2e8f0";
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const barColor = theme === "dark" ? "#a5b4fc" : "#6366f1";
  const tooltipStyle = {
    backgroundColor: theme === "dark" ? "#1e293b" : "#fff",
    border: "none",
    color: theme === "dark" ? "#f1f5f9" : "#0f172a",
  };

  const chartData = data.map((point) => ({
    week: new Date(point.period_start).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
    }),
    volumen: Math.round(point.total_volume_kg),
    series: point.total_sets,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: axisColor }} />
        <YAxis tick={{ fontSize: 12, fill: axisColor }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="volumen" fill={barColor} radius={[4, 4, 0, 0]} name="Volumen (kg)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
