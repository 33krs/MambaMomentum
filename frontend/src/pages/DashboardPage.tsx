import { useEffect, useState } from "react";

import { fetchFocusHeatmap, fetchFocusTrends, fetchSummary, fetchWorkoutVolume } from "../api/analytics";
import HeatmapCalendar from "../components/charts/HeatmapCalendar";
import TrendLineChart from "../components/charts/TrendLineChart";
import WeeklyVolumeChart from "../components/charts/WeeklyVolumeChart";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import type { DashboardSummary, HeatmapPoint, TrendPoint, VolumePoint } from "../types";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSummary(), fetchFocusHeatmap(182), fetchFocusTrends(12), fetchWorkoutVolume(12)])
      .then(([summaryData, heatmapData, trendsData, volumeData]) => {
        setSummary(summaryData);
        setHeatmap(heatmapData);
        setTrends(trendsData);
        setVolume(volumeData);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return <p className="text-slate-500">Cargando panel…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Panel de control</h1>
        <p className="text-sm text-slate-500">
          Resumen de tu productividad y actividad física de los últimos 7 días
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Minutos de concentración"
          value={String(summary?.focus_minutes_last_7_days ?? 0)}
        />
        <StatCard
          label="Bloques de concentración"
          value={String(summary?.focus_sessions_last_7_days ?? 0)}
        />
        <StatCard
          label="Entrenamientos"
          value={String(summary?.workout_sessions_last_7_days ?? 0)}
        />
        <StatCard
          label="Volumen levantado"
          value={`${Math.round(summary?.workout_volume_last_7_days_kg ?? 0)} kg`}
        />
        <StatCard
          label="Racha actual"
          value={`${summary?.current_focus_streak_days ?? 0} días`}
        />
      </div>

      <Card title="Mapa de calor de concentración">
        <HeatmapCalendar points={heatmap} weeksToShow={26} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Tendencia semanal de concentración">
          <TrendLineChart data={trends} />
        </Card>
        <Card title="Volumen de entrenamiento semanal">
          <WeeklyVolumeChart data={volume} />
        </Card>
      </div>
    </div>
  );
}
