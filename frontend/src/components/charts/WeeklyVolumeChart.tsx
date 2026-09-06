import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VolumePoint } from "../../types";

export default function WeeklyVolumeChart({ data }: { data: VolumePoint[] }) {
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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
        <Tooltip />
        <Bar dataKey="volumen" fill="#6366f1" radius={[4, 4, 0, 0]} name="Volumen (kg)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
