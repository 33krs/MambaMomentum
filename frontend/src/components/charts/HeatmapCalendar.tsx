import { useMemo } from "react";

import type { HeatmapPoint } from "../../types";

interface HeatmapCalendarProps {
  points: HeatmapPoint[];
  weeksToShow?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function intensityClass(minutes: number, max: number): string {
  if (minutes <= 0) return "bg-slate-100 dark:bg-slate-800";
  const ratio = max > 0 ? minutes / max : 0;
  if (ratio > 0.75) return "bg-brand-700";
  if (ratio > 0.5) return "bg-brand-600";
  if (ratio > 0.25) return "bg-brand-500";
  return "bg-brand-100";
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "2-digit" });
}

export default function HeatmapCalendar({ points, weeksToShow = 26 }: HeatmapCalendarProps) {
  const { weeks, max, avgPerDay } = useMemo(() => {
    const totalsByDate = new Map(points.map((point) => [point.date, point]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = weeksToShow * 7;
    const startOffset = (today.getDay() + 6) % 7; // align to Monday-start weeks
    const start = new Date(today.getTime() - (totalDays - 1 + startOffset) * DAY_MS);

    const days: { date: string; value: number; trained: boolean }[] = [];
    for (let i = 0; i < totalDays + startOffset + 1; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      const key = d.toISOString().slice(0, 10);
      const point = totalsByDate.get(key);
      days.push({ date: key, value: point?.value ?? 0, trained: point?.trained ?? false });
    }

    const weeksArr: { date: string; value: number; trained: boolean }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7));
    }

    const maxValue = Math.max(0, ...points.map((p) => p.value));
    const relevantDays = days.slice(-totalDays);
    const avg =
      relevantDays.length > 0
        ? relevantDays.reduce((sum, d) => sum + d.value, 0) / relevantDays.length
        : 0;

    return { weeks: weeksArr, max: maxValue, avgPerDay: avg };
  }, [points, weeksToShow]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${formatDayLabel(day.date)}\n${day.value} min de concentración\n${
                  day.trained ? "Entrenaste 💪" : "Sin entrenamiento"
                }`}
                className={`h-3.5 w-3.5 rounded-sm ${intensityClass(day.value, max)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
        Minutos de concentración por día · últimas {weeksToShow} semanas · promedio{" "}
        {avgPerDay.toFixed(1)} min/día
      </p>
    </div>
  );
}
