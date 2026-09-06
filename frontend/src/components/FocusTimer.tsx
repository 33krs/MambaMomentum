import { useEffect, useState } from "react";

import { createFocusSession } from "../api/focusSessions";
import { useCategories } from "../context/CategoriesContext";
import { playChime, unlockAudio } from "../utils/chime";

type Mode = "pomodoro" | "stopwatch";
type Phase = "work" | "break";

const PRESETS = [
  { label: "15/3", work: 15, break: 3 },
  { label: "25/5", work: 25, break: 5 },
  { label: "30/5", work: 30, break: 5 },
  { label: "40/10", work: 40, break: 10 },
  { label: "45/15", work: 45, break: 15 },
  { label: "50/10", work: 50, break: 10 },
  { label: "60/15", work: 60, break: 15 },
  { label: "90/20", work: 90, break: 20 },
];

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function FocusTimer({ onLogged }: { onLogged: () => void }) {
  const { categories } = useCategories();
  const [mode, setMode] = useState<Mode>("pomodoro");
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [phase, setPhase] = useState<Phase>("work");
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [phaseStartedAt, setPhaseStartedAt] = useState<Date | null>(null);
  const [category, setCategory] = useState(categories[0]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Si la categoría seleccionada se renombra o elimina, cae a la primera disponible.
  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  // Mantiene la cuenta regresiva sincronizada con los minutos configurados mientras no corre.
  useEffect(() => {
    if (!running) {
      setSecondsLeft((phase === "work" ? workMinutes : breakMinutes) * 60);
    }
  }, [workMinutes, breakMinutes, phase, running]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (mode === "stopwatch") {
        setElapsedSeconds((s) => s + 1);
      } else {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [running, mode]);

  useEffect(() => {
    if (mode === "pomodoro" && running && secondsLeft === 0) {
      completePhase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  async function logFocusSession(start: Date, end: Date, notes: string) {
    const minutes = (end.getTime() - start.getTime()) / 60000;
    if (minutes < 1) {
      setStatusMessage("Duró menos de un minuto, no se registró");
      return;
    }
    try {
      await createFocusSession({
        category,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes,
      });
      setStatusMessage("Bloque de concentración registrado ✓");
      onLogged();
    } catch {
      setStatusMessage("No se pudo registrar el bloque");
    }
  }

  function completePhase() {
    playChime();
    const now = new Date();
    if (phase === "work" && phaseStartedAt) {
      void logFocusSession(phaseStartedAt, now, "Pomodoro");
    }
    const nextPhase: Phase = phase === "work" ? "break" : "work";
    setPhase(nextPhase);
    setSecondsLeft((nextPhase === "work" ? workMinutes : breakMinutes) * 60);
    setPhaseStartedAt(now);
  }

  function applyPreset(preset: { work: number; break: number }) {
    setWorkMinutes(preset.work);
    setBreakMinutes(preset.break);
  }

  function handleModeChange(nextMode: Mode) {
    if (running) handleStop();
    setMode(nextMode);
    setStatusMessage(null);
  }

  function handleStart() {
    unlockAudio();
    setStatusMessage(null);
    const now = new Date();
    setPhaseStartedAt(now);
    if (mode === "pomodoro") {
      setPhase("work");
      setSecondsLeft(workMinutes * 60);
    } else {
      setElapsedSeconds(0);
    }
    setRunning(true);
  }

  function handleStop() {
    setRunning(false);
    const now = new Date();
    if (phaseStartedAt && (mode === "stopwatch" || phase === "work")) {
      void logFocusSession(phaseStartedAt, now, mode === "stopwatch" ? "Cronómetro libre" : "Pomodoro");
    }
    playChime();
    setPhase("work");
    setSecondsLeft(workMinutes * 60);
    setElapsedSeconds(0);
    setPhaseStartedAt(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["pomodoro", "stopwatch"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m
                ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {m === "pomodoro" ? "Pomodoro" : "Cronómetro libre"}
          </button>
        ))}
      </div>

      {mode === "pomodoro" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                disabled={running}
                className={`rounded-md border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                  workMinutes === preset.work && breakMinutes === preset.break
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                    : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              Trabajo (min)
              <input
                type="number"
                min={1}
                value={workMinutes}
                disabled={running}
                onChange={(e) => setWorkMinutes(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
            <label className="flex items-center gap-2">
              Descanso (min)
              <input
                type="number"
                min={1}
                value={breakMinutes}
                disabled={running}
                onChange={(e) => setBreakMinutes(Math.max(1, Number(e.target.value)))}
                className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>
          </div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {running ? (phase === "work" ? "Trabajando" : "Descansando") : "Listo para empezar"}
          </p>
          <p className="text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatTime(secondsLeft)}
          </p>
        </div>
      )}

      {mode === "stopwatch" && (
        <p className="text-4xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {formatTime(elapsedSeconds)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={running}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {running ? (
          <button
            onClick={handleStop}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Detener
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Iniciar
          </button>
        )}
      </div>

      {statusMessage && <p className="text-sm text-slate-500 dark:text-slate-400">{statusMessage}</p>}
    </div>
  );
}
