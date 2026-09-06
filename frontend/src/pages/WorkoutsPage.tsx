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
  WorkoutSetInput,
  WorkoutTemplate,
  WorkoutTemplateExerciseInput,
} from "../types";

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

export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Nuevo entrenamiento
  const [name, setName] = useState("Entrenamiento");
  const [date, setDate] = useState(todayInputValue());
  const [sets, setSets] = useState<WorkoutSetInput[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Catálogo de ejercicios: edición/borrado
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [editingExerciseName, setEditingExerciseName] = useState("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);

  // Plantillas
  const [templateName, setTemplateName] = useState("Rutina");
  const [templateItems, setTemplateItems] = useState<WorkoutTemplateExerciseInput[]>([]);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [applyDates, setApplyDates] = useState<Record<number, string>>({});

  // Edición de series de una sesión ya guardada
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingSets, setEditingSets] = useState<WorkoutSetInput[]>([]);
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

  function addSetRow() {
    if (exercises.length === 0) return;
    setSets((prev) => [
      ...prev,
      { exercise_id: exercises[0].id, set_number: prev.length + 1, reps: 8, weight_kg: 0 },
    ]);
  }

  function updateSet(index: number, patch: Partial<WorkoutSetInput>) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index));
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
    if (sets.length === 0) {
      setError("Agrega al menos una serie");
      return;
    }
    try {
      await createWorkoutSession({ name, date, sets });
      setSets([]);
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
    setTemplateItems((prev) => [
      ...prev,
      { exercise_id: exercises[0].id, sets_count: 3, order_index: prev.length },
    ]);
  }

  function updateTemplateItem(index: number, patch: Partial<WorkoutTemplateExerciseInput>) {
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
      await createWorkoutTemplate({ name: templateName, items: templateItems });
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

  // --- Edición de series de una sesión existente ---
  function startEditSession(session: WorkoutSession) {
    setSessionEditError(null);
    setEditingSessionId(session.id);
    setEditingSets(
      session.sets.map((s) => ({
        exercise_id: s.exercise_id ?? exercises[0]?.id ?? 0,
        set_number: s.set_number,
        reps: s.reps,
        weight_kg: s.weight_kg,
        rpe: s.rpe,
      })),
    );
  }

  function cancelEditSession() {
    setEditingSessionId(null);
    setEditingSets([]);
    setSessionEditError(null);
  }

  function updateEditingSet(index: number, patch: Partial<WorkoutSetInput>) {
    setEditingSets((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeEditingSet(index: number) {
    setEditingSets((prev) => prev.filter((_, i) => i !== index));
  }

  function addEditingSetRow() {
    if (exercises.length === 0) return;
    setEditingSets((prev) => [
      ...prev,
      { exercise_id: exercises[0].id, set_number: prev.length + 1, reps: 8, weight_kg: 0 },
    ]);
  }

  async function handleSaveSessionEdit(sessionId: number) {
    try {
      setSessionEditError(null);
      await updateWorkoutSession(sessionId, { sets: editingSets });
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
        <p className="text-sm text-slate-500 dark:text-slate-400">Registra tus sesiones con series, repeticiones y peso</p>
      </div>

      <Card title="Catálogo de ejercicios">
        <form onSubmit={handleAddExercise} className="flex gap-2">
          <input
            type="text"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            placeholder="Nuevo ejercicio (p. ej. Sentadilla)"
            className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            Añadir
          </button>
        </form>
        {exerciseError && <p className="mt-2 text-sm text-red-600">{exerciseError}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {exercises.map((ex) =>
            editingExerciseId === ex.id ? (
              <div key={ex.id} className="flex items-center gap-1 rounded-full bg-brand-50 dark:bg-brand-900/30 px-2 py-1">
                <input
                  autoFocus
                  type="text"
                  value={editingExerciseName}
                  onChange={(e) => setEditingExerciseName(e.target.value)}
                  className="w-32 rounded border border-brand-300 px-1.5 py-0.5 text-xs"
                />
                <button
                  onClick={() => handleSaveExerciseName(ex.id)}
                  className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingExerciseId(null)}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <span
                key={ex.id}
                className="flex items-center gap-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 px-3 py-1 text-xs text-brand-700 dark:text-brand-300"
              >
                {ex.name}
                <button
                  onClick={() => startEditExercise(ex)}
                  className="text-brand-500 dark:text-brand-400 hover:text-brand-800"
                  title="Renombrar"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDeleteExercise(ex.id)}
                  className="text-brand-500 dark:text-brand-400 hover:text-red-600"
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
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm sm:w-64"
          />
          <div className="space-y-2">
            {templateItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={item.exercise_id}
                  onChange={(e) => updateTemplateItem(index, { exercise_id: Number(e.target.value) })}
                  className="col-span-7 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
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
                  className="col-span-3 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
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
              className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
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
          <div className="mt-5 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
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
                    onChange={(e) =>
                      setApplyDates((prev) => ({ ...prev, [tpl.id]: e.target.value }))
                    }
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1 text-xs"
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
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            {sets.map((set, index) => (
              <div key={index} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={set.exercise_id}
                  onChange={(e) => updateSet(index, { exercise_id: Number(e.target.value) })}
                  className="col-span-5 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
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
                  value={set.reps}
                  onChange={(e) => updateSet(index, { reps: Number(e.target.value) })}
                  className="col-span-2 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Reps"
                />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={set.weight_kg}
                  onChange={(e) => updateSet(index, { weight_kg: Number(e.target.value) })}
                  className="col-span-2 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="Kg"
                />
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={set.rpe ?? ""}
                  onChange={(e) =>
                    updateSet(index, { rpe: e.target.value ? Number(e.target.value) : null })
                  }
                  className="col-span-2 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
                  placeholder="RPE"
                />
                <button
                  type="button"
                  onClick={() => removeSet(index)}
                  className="col-span-1 text-xs font-medium text-red-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addSetRow}
              disabled={exercises.length === 0}
              className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              + Añadir serie
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
              <div key={session.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
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
                          className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={cancelEditSession}
                          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEditSession(session)}
                        className="text-xs font-medium text-brand-700 dark:text-brand-300 hover:underline"
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
                    {editingSets.map((set, index) => (
                      <div key={index} className="grid grid-cols-12 items-center gap-2">
                        <select
                          value={set.exercise_id}
                          onChange={(e) =>
                            updateEditingSet(index, { exercise_id: Number(e.target.value) })
                          }
                          className="col-span-5 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
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
                          value={set.reps}
                          onChange={(e) => updateEditingSet(index, { reps: Number(e.target.value) })}
                          className="col-span-2 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
                          placeholder="Reps"
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={set.weight_kg}
                          onChange={(e) =>
                            updateEditingSet(index, { weight_kg: Number(e.target.value) })
                          }
                          className="col-span-2 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
                          placeholder="Kg"
                        />
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.5}
                          value={set.rpe ?? ""}
                          onChange={(e) =>
                            updateEditingSet(index, {
                              rpe: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          className="col-span-2 rounded-md border border-slate-300 dark:border-slate-700 px-2 py-1.5 text-sm"
                          placeholder="RPE"
                        />
                        <button
                          type="button"
                          onClick={() => removeEditingSet(index)}
                          className="col-span-1 text-xs font-medium text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addEditingSetRow}
                      disabled={exercises.length === 0}
                      className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      + Añadir serie
                    </button>
                    {sessionEditError && <p className="text-sm text-red-600">{sessionEditError}</p>}
                  </div>
                ) : (
                  <table className="mt-3 w-full text-left text-sm">
                    <thead>
                      <tr className="text-slate-500 dark:text-slate-400">
                        <th className="py-1 pr-4">Ejercicio</th>
                        <th className="py-1 pr-4">Serie</th>
                        <th className="py-1 pr-4">Reps</th>
                        <th className="py-1 pr-4">Peso</th>
                        <th className="py-1 pr-4">RPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.sets.map((set) => (
                        <tr key={set.id} className="text-slate-700 dark:text-slate-300">
                          <td className="py-1 pr-4">
                            {set.exercise?.name ?? set.exercise_name}
                            {!set.exercise && (
                              <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">(eliminado)</span>
                            )}
                          </td>
                          <td className="py-1 pr-4">{set.set_number}</td>
                          <td className="py-1 pr-4">{set.reps}</td>
                          <td className="py-1 pr-4">{set.weight_kg} kg</td>
                          <td className="py-1 pr-4">{set.rpe ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
