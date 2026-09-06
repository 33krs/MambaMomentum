import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";

import {
  applyWorkoutTemplate,
  createExercise,
  createWorkoutSession,
  createWorkoutTemplate,
  deleteExercise,
  deleteWorkoutSession,
  deleteWorkoutTemplate,
  listExercises,
  listWorkoutSessions,
  listWorkoutTemplates,
  updateExercise,
  updateWorkoutSession,
} from "../api/workouts";
import Card from "../components/ui/Card";
import type {
  Exercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutSetInput,
  WorkoutTemplate,
} from "../types";

interface ExerciseRow {
  exercise_id: number;
  sets_count: number;
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";
const smallInputClass =
  "rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

function expandRows(rows: ExerciseRow[]): WorkoutSetInput[] {
  const result: WorkoutSetInput[] = [];
  for (const row of rows) {
    for (let i = 1; i <= row.sets_count; i++) {
      result.push({ exercise_id: row.exercise_id, set_number: i, reps: 1, weight_kg: 0, rpe: null });
    }
  }
  return result;
}

function collapseSetsToRows(sets: WorkoutSet[], fallbackExerciseId: number): ExerciseRow[] {
  const order: number[] = [];
  const counts = new Map<number, number>();
  for (const s of sets) {
    const id = s.exercise_id ?? fallbackExerciseId;
    if (!counts.has(id)) {
      counts.set(id, 0);
      order.push(id);
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order.map((id) => ({ exercise_id: id, sets_count: counts.get(id) ?? 1 }));
}

function groupSetsByExercise(
  sets: WorkoutSet[],
): { key: string; name: string; deleted: boolean; count: number }[] {
  const order: string[] = [];
  const map = new Map<string, { name: string; deleted: boolean; count: number }>();
  for (const s of sets) {
    const key = s.exercise_id != null ? `id:${s.exercise_id}` : `name:${s.exercise_name}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { name: s.exercise?.name ?? s.exercise_name, deleted: !s.exercise, count: 1 });
      order.push(key);
    }
  }
  return order.map((key) => ({ key, ...map.get(key)! }));
}

export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Nuevo entrenamiento
  const [name, setName] = useState("Entrenamiento");
  const [date, setDate] = useState(todayInputValue());
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Catálogo de ejercicios: edición/borrado
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [editingExerciseName, setEditingExerciseName] = useState("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);

  // Plantillas
  const [templateName, setTemplateName] = useState("Rutina");
  const [templateItems, setTemplateItems] = useState<ExerciseRow[]>([]);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [applyDates, setApplyDates] = useState<Record<number, string>>({});

  // Edición de una sesión ya guardada
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingRows, setEditingRows] = useState<ExerciseRow[]>([]);
  const [sessionEditError, setSessionEditError] = useState<string | null>(null);

  function loadData() {
    setIsLoading(true);
    Promise.all([listWorkoutSessions(), listExercises(), listWorkoutTemplates()])
      .then(([workoutData, exerciseData, templateData]) => {
        setSessions(workoutData);
        setExercises(exerciseData);
        setTemplates(templateData);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(loadData, []);

  function addRow() {
    if (exercises.length === 0) return;
    setRows((prev) => [...prev, { exercise_id: exercises[0].id, sets_count: 3 }]);
  }

  function updateRow(index: number, patch: Partial<ExerciseRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddExercise(event: FormEvent) {
    event.preventDefault();
    if (!newExerciseName.trim()) return;
    const exercise = await createExercise(newExerciseName.trim());
    setExercises((prev) => [...prev, exercise].sort((a, b) => a.name.localeCompare(b.name)));
    setNewExerciseName("");
  }

  function startEditExercise(exercise: Exercise) {
    setExerciseError(null);
    setEditingExerciseId(exercise.id);
    setEditingExerciseName(exercise.name);
  }

  async function handleSaveExerciseName(id: number) {
    if (!editingExerciseName.trim()) return;
    try {
      setExerciseError(null);
      await updateExercise(id, { name: editingExerciseName.trim() });
      setEditingExerciseId(null);
      loadData();
    } catch (err) {
      setExerciseError(apiErrorMessage(err, "No se pudo renombrar el ejercicio"));
    }
  }

  async function handleDeleteExercise(id: number) {
    try {
      setExerciseError(null);
      await deleteExercise(id);
      loadData();
    } catch (err) {
      setExerciseError(apiErrorMessage(err, "No se pudo eliminar el ejercicio"));
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (rows.length === 0) {
      setError("Agrega al menos un ejercicio");
      return;
    }
    try {
      await createWorkoutSession({ name, date, sets: expandRows(rows) });
      setRows([]);
      setName("Entrenamiento");
      loadData();
    } catch {
      setError("No se pudo guardar el entrenamiento");
    }
  }

  async function handleDelete(id: number) {
    await deleteWorkoutSession(id);
    loadData();
  }

  // --- Plantillas ---
  function addTemplateItemRow() {
    if (exercises.length === 0) return;
    setTemplateItems((prev) => [...prev, { exercise_id: exercises[0].id, sets_count: 3 }]);
  }

  function updateTemplateItem(index: number, patch: Partial<ExerciseRow>) {
    setTemplateItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function removeTemplateItem(index: number) {
    setTemplateItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateTemplate(event: FormEvent) {
    event.preventDefault();
    setTemplateError(null);
    if (templateItems.length === 0) {
      setTemplateError("Agrega al menos un ejercicio a la plantilla");
      return;
    }
    try {
      await createWorkoutTemplate({
        name: templateName,
        items: templateItems.map((it, i) => ({ ...it, order_index: i })),
      });
      setTemplateItems([]);
      setTemplateName("Rutina");
      loadData();
    } catch {
      setTemplateError("No se pudo guardar la plantilla");
    }
  }

  async function handleDeleteTemplate(id: number) {
    await deleteWorkoutTemplate(id);
    loadData();
  }

  async function handleApplyTemplate(id: number) {
    const applyDate = applyDates[id] || todayInputValue();
    await applyWorkoutTemplate(id, applyDate);
    loadData();
  }

  // --- Edición de una sesión existente ---
  function startEditSession(session: WorkoutSession) {
    setSessionEditError(null);
    setEditingSessionId(session.id);
    setEditingRows(collapseSetsToRows(session.sets, exercises[0]?.id ?? 0));
  }

  function cancelEditSession() {
    setEditingSessionId(null);
    setEditingRows([]);
    setSessionEditError(null);
  }

  function updateEditingRow(index: number, patch: Partial<ExerciseRow>) {
    setEditingRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeEditingRow(index: number) {
    setEditingRows((prev) => prev.filter((_, i) => i !== index));
  }

  function addEditingRow() {
    if (exercises.length === 0) return;
    setEditingRows((prev) => [...prev, { exercise_id: exercises[0].id, sets_count: 3 }]);
  }

  async function handleSaveSessionEdit(sessionId: number) {
    try {
      setSessionEditError(null);
      await updateWorkoutSession(sessionId, { sets: expandRows(editingRows) });
      cancelEditSession();
      loadData();
    } catch {
      setSessionEditError("No se pudieron guardar los cambios");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Entrenamientos de fuerza</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Registra qué ejercicios y cuántas series hiciste</p>
      </div>

      <Card title="Catálogo de ejercicios">
        <form onSubmit={handleAddExercise} className="flex gap-2">
          <input
            type="text"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            placeholder="Nuevo ejercicio (p. ej. Sentadilla)"
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Añadir
          </button>
        </form>
        {exerciseError && <p className="mt-2 text-sm text-red-600">{exerciseError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {exercises.map((ex) =>
            editingExerciseId === ex.id ? (
              <div key={ex.id} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 dark:bg-brand-900/30">
                <input
                  autoFocus
                  type="text"
                  value={editingExerciseName}
                  onChange={(e) => setEditingExerciseName(e.target.value)}
                  className="w-32 rounded border border-brand-300 px-1.5 py-0.5 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={() => handleSaveExerciseName(ex.id)}
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingExerciseId(null)}
                  className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <span
                key={ex.id}
                className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
              >
                {ex.name}
                <button
                  onClick={() => startEditExercise(ex)}
                  className="text-brand-500 hover:text-brand-800 dark:text-brand-400"
                  title="Renombrar"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteExercise(ex.id)}
                  className="text-brand-500 hover:text-red-600 dark:text-brand-400"
                  title="Eliminar"
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
      </Card>

      <Card title="Plantillas de entrenamiento">
        <form onSubmit={handleCreateTemplate} className="space-y-3">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Nombre de la plantilla (p. ej. Pull)"
            className={`w-full sm:w-64 ${inputClass}`}
          />
          <div className="space-y-2">
            {templateItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={item.exercise_id}
                  onChange={(e) => updateTemplateItem(index, { exercise_id: Number(e.target.value) })}
                  className={`col-span-7 ${smallInputClass}`}
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.sets_count}
                  onChange={(e) => updateTemplateItem(index, { sets_count: Number(e.target.value) })}
                  className={`col-span-3 ${smallInputClass}`}
                  placeholder="N.º series"
                />
                <button
                  type="button"
                  onClick={() => removeTemplateItem(index)}
                  className="col-span-2 text-xs font-medium text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addTemplateItemRow}
              disabled={exercises.length === 0}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + Añadir ejercicio
            </button>
          </div>
          {templateError && <p className="text-sm text-red-600">{templateError}</p>}
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Guardar plantilla
          </button>
        </form>

        {templates.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-slate-100">{tpl.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {tpl.items.map((it) => `${it.exercise.name} x${it.sets_count}`).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={applyDates[tpl.id] ?? todayInputValue()}
                    onChange={(e) => setApplyDates((prev) => ({ ...prev, [tpl.id]: e.target.value }))}
                    className={`px-2 py-1 text-xs ${inputClass}`}
                  />
                  <button
                    onClick={() => handleApplyTemplate(tpl.id)}
                    className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700"
                  >
                    Usar plantilla
                  </button>
                  <button
                    onClick={() => handleDeleteTemplate(tpl.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Nuevo entrenamiento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 w-full ${inputClass}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`mt-1 w-full ${inputClass}`}
              />
            </div>
          </div>

          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={row.exercise_id}
                  onChange={(e) => updateRow(index, { exercise_id: Number(e.target.value) })}
                  className={`col-span-7 ${smallInputClass}`}
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={row.sets_count}
                  onChange={(e) => updateRow(index, { sets_count: Number(e.target.value) })}
                  className={`col-span-3 ${smallInputClass}`}
                  placeholder="N.º series"
                />
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="col-span-2 text-xs font-medium text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              disabled={exercises.length === 0}
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + Añadir ejercicio
            </button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Guardar entrenamiento
          </button>
        </form>
      </Card>

      <Card title="Historial">
        {isLoading ? (
          <p className="text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Aún no has registrado entrenamientos.</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{session.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(session.date).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {editingSessionId === session.id ? (
                      <>
                        <button
                          onClick={() => handleSaveSessionEdit(session.id)}
                          className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditSession}
                          className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditSession(session)}
                        className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                      >
                        Editar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {editingSessionId === session.id ? (
                  <div className="mt-3 space-y-2">
                    {editingRows.map((row, index) => (
                      <div key={index} className="grid grid-cols-12 items-center gap-2">
                        <select
                          value={row.exercise_id}
                          onChange={(e) => updateEditingRow(index, { exercise_id: Number(e.target.value) })}
                          className={`col-span-7 ${smallInputClass}`}
                        >
                          {exercises.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={row.sets_count}
                          onChange={(e) => updateEditingRow(index, { sets_count: Number(e.target.value) })}
                          className={`col-span-3 ${smallInputClass}`}
                          placeholder="N.º series"
                        />
                        <button
                          type="button"
                          onClick={() => removeEditingRow(index)}
                          className="col-span-2 text-xs font-medium text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addEditingRow}
                      disabled={exercises.length === 0}
                      className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      + Añadir ejercicio
                    </button>
                    {sessionEditError && <p className="text-sm text-red-600">{sessionEditError}</p>}
                  </div>
                ) : (
                  <ul className="mt-3 space-y-1 text-sm">
                    {groupSetsByExercise(session.sets).map((g) => (
                      <li key={g.key} className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
                        <span className="text-slate-700 dark:text-slate-300">
                          {g.name}
                          {g.deleted && (
                            <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">(eliminado)</span>
                          )}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {g.count} {g.count === 1 ? "serie" : "series"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
