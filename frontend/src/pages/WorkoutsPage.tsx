import { useEffect, useState, type FormEvent } from "react";

import {
  createExercise,
  createWorkoutSession,
  deleteWorkoutSession,
  listExercises,
  listWorkoutSessions,
} from "../api/workouts";
import Card from "../components/ui/Card";
import type { Exercise, WorkoutSession, WorkoutSetInput } from "../types";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState("Entrenamiento");
  const [date, setDate] = useState(todayInputValue());
  const [sets, setSets] = useState<WorkoutSetInput[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function loadData() {
    setIsLoading(true);
    Promise.all([listWorkoutSessions(), listExercises()])
      .then(([workoutData, exerciseData]) => {
        setSessions(workoutData);
        setExercises(exerciseData);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Entrenamientos de fuerza</h1>
        <p className="text-sm text-slate-500">Registra tus sesiones con series, repeticiones y peso</p>
      </div>

      <Card title="Catálogo de ejercicios">
        <form onSubmit={handleAddExercise} className="flex gap-2">
          <input
            type="text"
            value={newExerciseName}
            onChange={(e) => setNewExerciseName(e.target.value)}
            placeholder="Nuevo ejercicio (p. ej. Sentadilla)"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            Añadir
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {exercises.map((ex) => (
            <span key={ex.id} className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
              {ex.name}
            </span>
          ))}
        </div>
      </Card>

      <Card title="Nuevo entrenamiento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            {sets.map((set, index) => (
              <div key={index} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={set.exercise_id}
                  onChange={(e) => updateSet(index, { exercise_id: Number(e.target.value) })}
                  className="col-span-5 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
                  className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  placeholder="Reps"
                />
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={set.weight_kg}
                  onChange={(e) => updateSet(index, { weight_kg: Number(e.target.value) })}
                  className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
                  className="col-span-2 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
              className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
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
          <p className="text-slate-500">Cargando…</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500">Aún no has registrado entrenamientos.</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{session.name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(session.date).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(session.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="py-1 pr-4">Ejercicio</th>
                      <th className="py-1 pr-4">Serie</th>
                      <th className="py-1 pr-4">Reps</th>
                      <th className="py-1 pr-4">Peso</th>
                      <th className="py-1 pr-4">RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.sets.map((set) => (
                      <tr key={set.id} className="text-slate-700">
                        <td className="py-1 pr-4">{set.exercise.name}</td>
                        <td className="py-1 pr-4">{set.set_number}</td>
                        <td className="py-1 pr-4">{set.reps}</td>
                        <td className="py-1 pr-4">{set.weight_kg} kg</td>
                        <td className="py-1 pr-4">{set.rpe ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
