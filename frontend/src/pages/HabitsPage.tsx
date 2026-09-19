import axios from "axios";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { archiveHabit, createHabit, fetchHabitStats, listHabits, markHabit, unmarkHabit, updateHabit } from "../api/habits";
import Card from "../components/ui/Card";
import type { Habit, HabitStats } from "../types";

interface EditingHabit {
  id: number;
  name: string;
  color: string;
}

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromValue(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string): string {
  return dateFromValue(value).toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" });
}

function datesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = dateFromValue(start);
  const last = dateFromValue(end);
  while (cursor <= last) {
    dates.push(localDateValue(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.detail === "string") return error.response.data.detail;
  return fallback;
}

function isMarkedOn(habit: Habit, date: string): boolean {
  return habit.logs.some((log) => log.date === date);
}

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stats, setStats] = useState<HabitStats | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [editingHabit, setEditingHabit] = useState<EditingHabit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);

  const today = stats?.end ?? localDateValue();
  const activeHabits = habits.filter((habit) => habit.status === "active");
  const archivedHabits = habits.filter((habit) => habit.status === "archived");
  const weekDates = stats ? datesInRange(stats.start, stats.end) : [];
  const isFutureDate = selectedDate > today;

  useEffect(() => {
    if (!editingHabit) return;
    editNameInputRef.current?.focus();
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setEditingHabit(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [editingHabit]);

  useEffect(() => {
    if (!editingHabit) editTriggerRef.current?.focus();
  }, [editingHabit]);

  function closeEditDialog() {
    setEditingHabit(null);
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [habitData, statsData] = await Promise.all([listHabits(true), fetchHabitStats()]);
      setHabits(habitData);
      setStats(statsData);
      setError(null);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "No se pudieron cargar los hábitos"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (stats && !selectedDate) setSelectedDate(stats.end);
  }, [selectedDate, stats]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Ingresa un nombre para el hábito");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await createHabit({ name: trimmedName, color });
      setName("");
      setAnnouncement(`Hábito ${trimmedName} creado`);
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "No se pudo crear el hábito"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleLog(habit: Habit) {
    if (selectedDate > today) {
      setError("No se permiten fechas futuras");
      return;
    }

    setIsSaving(true);
    setError(null);
    const marked = isMarkedOn(habit, selectedDate);
    try {
      if (marked) {
        await unmarkHabit(habit.id, selectedDate);
        setAnnouncement(`${habit.name} desmarcado para ${formatDate(selectedDate)}`);
      } else if (selectedDate === today) {
        await markHabit(habit.id);
        setAnnouncement(`${habit.name} marcado para hoy`);
      } else {
        await markHabit(habit.id, selectedDate);
        setAnnouncement(`${habit.name} marcado para ${formatDate(selectedDate)}`);
      }
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "No se pudo actualizar el registro"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingHabit) return;
    const trimmedName = editingHabit.name.trim();
    if (!trimmedName) {
      setError("Ingresa un nombre para el hábito");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await updateHabit(editingHabit.id, { name: trimmedName, color: editingHabit.color });
      setAnnouncement(`Hábito ${trimmedName} actualizado`);
      setEditingHabit(null);
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "No se pudo actualizar el hábito"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleArchive(habit: Habit) {
    setIsSaving(true);
    setError(null);
    try {
      await archiveHabit(habit.id);
      setAnnouncement(`Hábito ${habit.name} archivado`);
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "No se pudo archivar el hábito"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRestore(habit: Habit) {
    setIsSaving(true);
    setError(null);
    try {
      await updateHabit(habit.id, { status: "active" });
      setAnnouncement(`Hábito ${habit.name} reactivado`);
      await loadData();
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "No se pudo reactivar el hábito"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Bienestar</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Hábitos</h1>
        <p className="mt-2 max-w-xl text-sm text-brand-100">Registra tu progreso diario y mantené el impulso.</p>
      </header>

      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="space-y-6">
          <Card title="Registrar hábitos">
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
              <div>
                <label htmlFor="habit-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del hábito</label>
                <input id="habit-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" placeholder="Ej. Leer 20 minutos" />
              </div>
              <div>
                <label htmlFor="habit-color" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
                <input id="habit-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-1 h-10 w-full cursor-pointer rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800 sm:w-14" />
              </div>
              <button type="submit" disabled={isSaving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">Añadir hábito</button>
            </form>
          </Card>

          <Card title="Seguimiento diario">
            <div className="mb-5 max-w-xs">
              <label htmlFor="habit-date" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha a registrar</label>
              <input id="habit-date" type="date" value={selectedDate} max={today} onChange={(event) => setSelectedDate(event.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Podés editar registros anteriores, nunca fechas futuras.</p>
            </div>

            {isLoading ? <p className="text-slate-500">Cargando hábitos…</p> : activeHabits.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">Todavía no tenés hábitos activos. Creá uno para empezar a registrar tu progreso.</p>
            ) : (
              <ul className="space-y-3" aria-label="Hábitos activos">
                {activeHabits.map((habit) => {
                  const marked = isMarkedOn(habit, selectedDate);
                  return (
                    <li key={habit.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: habit.color || "#64748b" }} />
                        <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{habit.name}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void handleToggleLog(habit)} disabled={isSaving || isFutureDate} aria-pressed={marked} className={`rounded-md px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${marked ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-brand-600 text-white hover:bg-brand-700"}`}>{marked ? "Desmarcar" : "Marcar"}</button>
                        <button type="button" ref={editTriggerRef} onClick={(event) => { editTriggerRef.current = event.currentTarget; setEditingHabit({ id: habit.id, name: habit.name, color: habit.color || "#64748b" }); }} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Editar</button>
                        <button type="button" onClick={() => void handleArchive(habit)} disabled={isSaving} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Archivar</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {archivedHabits.length > 0 && <Card title="Hábitos archivados">
            <ul className="space-y-3" aria-label="Hábitos archivados">
              {archivedHabits.map((habit) => <li key={habit.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{habit.name}</span>
                <button type="button" onClick={() => void handleRestore(habit)} disabled={isSaving} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Reactivar</button>
              </li>)}
            </ul>
          </Card>}
        </div>

        <Card title="Resumen semanal" className="h-fit">
          {isLoading || !stats ? <p className="text-slate-500">Cargando resumen…</p> : stats.active_habits === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Creá un hábito activo para ver tu progreso semanal.</p>
          ) : <>
            <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(stats.start)} — {formatDate(stats.end)}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-brand-700 dark:text-brand-400">{Math.round(stats.percentage)}%</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{stats.completed} completados de {stats.active_habits * stats.elapsed_days} posibles</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><dt className="text-slate-500 dark:text-slate-400">Hábitos activos</dt><dd className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">{stats.active_habits}</dd></div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><dt className="text-slate-500 dark:text-slate-400">Racha actual</dt><dd className="mt-1 text-lg font-bold text-slate-800 dark:text-slate-100">{stats.current_streak_days} días</dd></div>
            </dl>
            <div className="mt-5 grid grid-cols-7 gap-1" aria-label="Días del resumen semanal">
              {weekDates.map((date) => <div key={date} className="min-w-0 rounded-md bg-brand-50 p-1 text-center text-[10px] font-semibold text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"><time dateTime={date}>{dateFromValue(date).toLocaleDateString("es-CL", { weekday: "narrow" })}</time></div>)}
            </div>
          </>}
        </Card>
      </div>

      {editingHabit && <div role="dialog" aria-modal="true" aria-labelledby="edit-habit-title" aria-describedby="edit-habit-description" className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
        <form onSubmit={handleSaveEdit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <h2 id="edit-habit-title" className="text-xl font-bold text-slate-800 dark:text-slate-100">Editar hábito</h2>
          <p id="edit-habit-description" className="sr-only">Edita el nombre y color del hábito. Presiona Escape para cancelar.</p>
          <div className="mt-4">
            <label htmlFor="edit-habit-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del hábito</label>
            <input id="edit-habit-name" ref={editNameInputRef} value={editingHabit.name} onChange={(event) => setEditingHabit({ ...editingHabit, name: event.target.value })} maxLength={120} required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
          </div>
          <div className="mt-4">
            <label htmlFor="edit-habit-color" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Color</label>
            <input id="edit-habit-color" type="color" value={editingHabit.color} onChange={(event) => setEditingHabit({ ...editingHabit, color: event.target.value })} className="mt-1 h-10 w-14 cursor-pointer rounded border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800" />
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={closeEditDialog} className="rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={isSaving} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">Guardar cambios</button>
          </div>
        </form>
      </div>}
    </div>
  );
}
