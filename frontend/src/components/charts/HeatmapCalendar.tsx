import { useMemo } from "react";

import type { HeatmapPoint } from "../../types";

interface HeatmapCalendarProps {
  points: HeatmapPoint[];
  weeksToShow?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function intensityClass(minutes: number, max: number): string {
  if (minutes <= 0) return "bg-slate-100";
  const ratio = max > 0 ? minutes / max : 0;
  if (ratio > 0.75) return "bg-brand-700";
  if (ratio > 0.5) return "bg-brand-600";
  if (ratio > 0.25) return "bg-brand-500";
  return "bg-brand-100";
}

export default function HeatmapCalendar({ points, weeksToShow = 26 }: HeatmapCalendarProps) {
  const { weeks, max } = useMemo(() => {
    const totalsByDate = new Map(points.map((point) => [point.date, point.value]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalDays = weeksToShow * 7;
    const startOffset = (today.getDay() + 6) % 7; // align to Monday-start weeks
    const start = new Date(today.getTime() - (totalDays - 1 + startOffset) * DAY_MS);

    const days: { date: string; value: number }[] = [];
    for (let i = 0; i < totalDays + startOffset + 1; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, value: totalsByDate.get(key) ?? 0 });
    }

    const weeksArr: { date: string; value: number }[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeksArr.push(days.slice(i, i + 7));
    }

    const maxValue = Math.max(0, ...points.map((p) => p.value));
    return { weeks: weeksArr, max: maxValue };
  }, [points, weeksToShow]);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.value} min`}
                className={`h-3.5 w-3.5 rounded-sm ${intensityClass(day.value, max)}`}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Minutos de concentración por día · últimas {weeksToShow} semanas
      </p>
    </div>
  );
}
