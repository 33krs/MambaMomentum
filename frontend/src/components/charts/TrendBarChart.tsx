import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipProps } from "recharts";

import { useTheme } from "../../context/ThemeContext";
import type { TrendPoint } from "../../types";

function TrendTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as
    | { minutos: number; sesiones: number; promedio: number }
    | undefined;
  if (!point) return null;

  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">{label}</p>
      <p className="text-slate-600 dark:text-slate-300">Minutos totales: {point.minutos}</p>
      <p className="text-slate-600 dark:text-slate-300">Sesiones: {point.sesiones}</p>
      <p className="text-slate-600 dark:text-slate-300">Promedio por sesión: {point.promedio} min</p>
    </div>
  );
}

export default function TrendBarChart({ data }: { data: TrendPoint[] }) {
  const { theme } = useTheme();
  const gridColor = theme === "dark" ? "#334155" : "#e2e8f0";
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const barColor = theme === "dark" ? "#818cf8" : "#4f46e5";

  const chartData = data.map((point) => ({
    week: new Date(point.period_start).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
    }),
    minutos: point.total_minutes,
    sesiones: point.session_count,
    promedio: Math.round(point.avg_session_minutes),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: axisColor }} />
        <YAxis tick={{ fontSize: 12, fill: axisColor }} />
        <Tooltip content={<TrendTooltip />} />
        <Bar dataKey="minutos" fill={barColor} radius={[4, 4, 0, 0]} name="Minutos de concentración" />
      </BarChart>
    </ResponsiveContainer>
  );
}
