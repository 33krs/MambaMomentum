import { useEffect, useState } from "react";

import { fetchFocusHeatmap, fetchFocusTrends, fetchSummary, fetchWorkoutVolume } from "../api/analytics";
import HeatmapCalendar from "../components/charts/HeatmapCalendar";
import TrendBarChart from "../components/charts/TrendBarChart";
import WeeklyVolumeChart from "../components/charts/WeeklyVolumeChart";
import Card from "../components/ui/Card";
import StatCard from "../components/ui/StatCard";
import type { DashboardSummary, HeatmapPoint, TrendPoint, VolumePoint } from "../types";

const TREND_PERIODS = [8, 12, 26];

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapPoint[]>([]);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [volume, setVolume] = useState<VolumePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [trendWeeks, setTrendWeeks] = useState(12);

  useEffect(() => {
    Promise.all([fetchSummary(), fetchFocusHeatmap(182), fetchWorkoutVolume(12)])
      .then(([summaryData, heatmapData, volumeData]) => {
        setSummary(summaryData);
        setHeatmap(heatmapData);
        setVolume(volumeData);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchFocusTrends(trendWeeks).then(setTrends);
  }, [trendWeeks]);

  if (isLoading) {
    return <p className="text-slate-500">Cargando panel…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Panel de control</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Resumen de tu productividad y actividad física de los últimos 7 días
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Racha actual"
          value={`${summary?.current_focus_streak_days ?? 0} días`}
        />
      </div>

      <Card title="Mapa de calor de concentración">
        <HeatmapCalendar points={heatmap} weeksToShow={26} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Tendencia semanal de concentración">
          <div className="mb-3 flex gap-2">
            {TREND_PERIODS.map((weeks) => (
              <button
                key={weeks}
                onClick={() => setTrendWeeks(weeks)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  trendWeeks === weeks
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {weeks} semanas
              </button>
            ))}
          </div>
          <TrendBarChart data={trends} />
        </Card>
        <Card title="Volumen de entrenamiento semanal">
          <WeeklyVolumeChart data={volume} />
        </Card>
      </div>
    </div>
  );
}
