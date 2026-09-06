import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { TrendPoint } from "../../types";

export default function TrendLineChart({ data }: { data: TrendPoint[] }) {
  const chartData = data.map((point) => ({
    week: new Date(point.period_start).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
    }),
    minutos: point.total_minutes,
    sesiones: point.session_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="minutos"
          stroke="#4f46e5"
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Minutos de concentración"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
