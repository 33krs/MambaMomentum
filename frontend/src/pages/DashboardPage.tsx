import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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

  if (isLoading) return <p className="text-slate-500">Cargando panel…</p>;

  const focusMinutes = summary?.focus_minutes_last_7_days ?? 0;
  const workouts = summary?.workout_sessions_last_7_days ?? 0;

  return (
    <div className="space-y-6 pb-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-slate-900 px-6 py-8 text-white shadow-xl sm:px-8">
        <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Tu semana en perspectiva</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Panel de control</h1>
          <p className="mt-3 text-sm leading-6 text-brand-100">Un vistazo claro a tu concentración y entrenamiento de los últimos 7 días.</p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-semibold">{focusMinutes} min de foco</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-semibold">{workouts} entrenamientos</span>
          </div>
          <Link to="/habits" className="mt-6 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-bold text-brand-700 shadow-sm transition hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-brand-700">
            Abrir tracker de hábitos
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Minutos de concentración" value={String(focusMinutes)} hint="Últimos 7 días" />
        <StatCard label="Bloques de concentración" value={String(summary?.focus_sessions_last_7_days ?? 0)} hint="Sesiones registradas" />
        <StatCard label="Entrenamientos" value={String(workouts)} hint="Últimos 7 días" />
        <StatCard label="Racha actual" value={`${summary?.current_focus_streak_days ?? 0} días`} hint="Días consecutivos" />
      </div>

      <Card title="Mapa de calor de concentración" className="overflow-hidden">
        <p className="-mt-2 mb-5 text-sm text-slate-500 dark:text-slate-400">Cada bloque muestra cómo se distribuyó tu trabajo profundo.</p>
        <HeatmapCalendar points={heatmap} weeksToShow={26} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Tendencia semanal de concentración">
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">Evolución por semana</p>
            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" aria-label="Período de tendencia">
              {TREND_PERIODS.map((weeks) => (
                <button key={weeks} type="button" onClick={() => setTrendWeeks(weeks)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${trendWeeks === weeks ? "bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
                  {weeks} sem.
                </button>
              ))}
            </div>
          </div>
          <TrendBarChart data={trends} />
        </Card>
        <Card title="Series de entrenamiento semanal">
          <p className="-mt-2 mb-5 text-sm text-slate-500 dark:text-slate-400">Volumen registrado en tus rutinas.</p>
          <WeeklyVolumeChart data={volume} />
        </Card>
      </div>
    </div>
  );
}
