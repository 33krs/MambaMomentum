import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";

import {
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
  updateWorkoutTemplate,
} from "../api/workouts";
import Card from "../components/ui/Card";
import type { Exercise, WorkoutSession, WorkoutSet, WorkoutSetInput, WorkoutTemplate } from "../types";

interface ExerciseRow {
  exercise_id: number | null;
  sets_count: number;
}

interface SelectedExerciseRow extends ExerciseRow {
  exercise_id: number;
}

interface ExercisePickerProps {
  exercises: Exercise[];
  value: number | null;
  onChange: (exerciseId: number) => void;
  autoFocus?: boolean;
}

const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-brand-900";
const smallInputClass = "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && typeof err.response?.data?.detail === "string") return err.response.data.detail;
  return fallback;
}

function expandRows(rows: ExerciseRow[]): WorkoutSetInput[] {
  return rows.flatMap((row) => {
    if (row.exercise_id === null) return [];
    const exerciseId: number = row.exercise_id;
    return Array.from({ length: row.sets_count }, (_, index) => ({
      exercise_id: exerciseId,
      set_number: index + 1,
      reps: 1,
      weight_kg: 0,
      rpe: null,
    }));
  });
}

function collapseSetsToRows(sets: WorkoutSet[]): ExerciseRow[] {
  const counts = new Map<number, number>();
  for (const set of sets) {
    if (set.exercise_id !== null) counts.set(set.exercise_id, (counts.get(set.exercise_id) ?? 0) + 1);
  }
  return [...counts].map(([exercise_id, sets_count]) => ({ exercise_id, sets_count }));
}

function ExercisePicker({ exercises, value, onChange, autoFocus = false }: ExercisePickerProps) {
  const [query, setQuery] = useState(exercises.find((exercise) => exercise.id === value)?.name ?? "");
  const [isOpen, setIsOpen] = useState(autoFocus);

  useEffect(() => {
    setQuery(exercises.find((exercise) => exercise.id === value)?.name ?? "");
    setIsOpen(autoFocus && value === null);
  }, [autoFocus, exercises, value]);
  const filtered = exercises
    .filter((exercise) => exercise.name.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  function select(exercise: Exercise) {
    onChange(exercise.id);
    setQuery(exercise.name);
    setIsOpen(false);
  }

  return (
    <div className="relative col-span-7">
      <input
        type="search"
        autoFocus={autoFocus}
        value={query}
        onFocus={() => setIsOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }}
        placeholder="Buscar ejercicio"
        className={`w-full ${smallInputClass}`}
        aria-label="Buscar ejercicio"
      />
      {isOpen && (
        <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-slate-500">No hay coincidencias</p>
          ) : (
            filtered.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(exercise)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-900/30"
              >
                <span>{exercise.name}</span>
                {exercise.is_system && <span className="text-[10px] uppercase tracking-wide text-slate-400">Sistema</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseRows({ rows, exercises, onChange, onRemove }: {
  rows: ExerciseRow[];
  exercises: Exercise[];
  onChange: (index: number, patch: Partial<ExerciseRow>) => void;
  onRemove: (index: number) => void;
}) {
  return rows.map((row, index) => (
    <div key={index} className="grid grid-cols-12 items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
      <ExercisePicker exercises={exercises} value={row.exercise_id} autoFocus={row.exercise_id === null} onChange={(exercise_id) => onChange(index, { exercise_id })} />
      <input type="number" min={1} value={row.sets_count} onChange={(event) => onChange(index, { sets_count: Number(event.target.value) })} className={`col-span-3 ${smallInputClass}`} aria-label="Número de series" />
      <button type="button" onClick={() => onRemove(index)} className="col-span-2 text-xs font-semibold text-red-600 hover:underline">Quitar</button>
    </div>
  ));
}

export default function WorkoutsPage() {
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayInputValue());
  const [rows, setRows] = useState<ExerciseRow[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<number | null>(null);
  const [editingExerciseName, setEditingExerciseName] = useState("");
  const [exerciseError, setExerciseError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("Rutina");
  const [templateItems, setTemplateItems] = useState<ExerciseRow[]>([]);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingRows, setEditingRows] = useState<ExerciseRow[]>([]);
  const [sessionEditError, setSessionEditError] = useState<string | null>(null);

  function loadData() {
    setIsLoading(true);
    Promise.all([listWorkoutSessions(), listExercises(), listWorkoutTemplates()])
      .then(([workoutData, exerciseData, templateData]) => {
        setSessions(workoutData);
        setExercises(exerciseData.sort((a, b) => a.name.localeCompare(b.name, "es")));
        setTemplates(templateData);
      })
      .finally(() => setIsLoading(false));
  }

  useEffect(loadData, []);

  const updateRows = (setter: typeof setRows | typeof setTemplateItems | typeof setEditingRows, index: number, patch: Partial<ExerciseRow>) => {
    setter((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  };
  const removeRow = (setter: typeof setRows | typeof setTemplateItems | typeof setEditingRows, index: number) => setter((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
  const addRow = (setter: typeof setRows | typeof setTemplateItems | typeof setEditingRows) => {
    setter((previous) => [...previous, { exercise_id: null, sets_count: 3 }]);
  };

  async function handleAddExercise(event: FormEvent) {
    event.preventDefault();
    if (!newExerciseName.trim()) return;
    try {
      const exercise = await createExercise(newExerciseName.trim());
      setExercises((previous) => [...previous, exercise].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setNewExerciseName("");
    } catch (err) { setExerciseError(apiErrorMessage(err, "No se pudo añadir el ejercicio")); }
  }

  async function saveExerciseName(id: number) {
    if (!editingExerciseName.trim()) return;
    try { await updateExercise(id, { name: editingExerciseName.trim() }); setEditingExerciseId(null); loadData(); }
    catch (err) { setExerciseError(apiErrorMessage(err, "No se pudo renombrar el ejercicio")); }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setError(null);
    if (!name.trim()) { setError("Ingresa un nombre para el entrenamiento"); return; }
    if (!rows.length || rows.some((row) => row.exercise_id === null)) { setError("Selecciona un ejercicio para cada fila"); return; }
    try { await createWorkoutSession({ name: name.trim(), date, sets: expandRows(rows) }); setRows([]); setName(""); loadData(); }
    catch (err) { setError(apiErrorMessage(err, "No se pudo guardar el entrenamiento")); }
  }

  function hydrateTemplate(template: WorkoutTemplate) {
    const liveItems = template.items.filter((item) => item.exercise_id !== null).map((item) => ({ exercise_id: item.exercise_id!, sets_count: item.sets_count }));
    if (liveItems.length !== template.items.length) setError("La plantilla contiene ejercicios eliminados; revísala antes de guardar el entrenamiento.");
    setName(template.name); setRows(liveItems);
  }

  function editTemplate(template: WorkoutTemplate) {
    setEditingTemplateId(template.id); setTemplateName(template.name);
    setTemplateItems(template.items.filter((item) => item.exercise_id !== null).map((item) => ({ exercise_id: item.exercise_id!, sets_count: item.sets_count })));
    setTemplateError(template.items.some((item) => item.exercise_id === null) ? "Esta plantilla contiene ejercicios eliminados. Añade reemplazos antes de guardarla." : null);
  }

  function resetTemplateDraft() { setEditingTemplateId(null); setTemplateName("Rutina"); setTemplateItems([]); setTemplateError(null); }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault(); setTemplateError(null);
    const selectedItems = templateItems.filter((item): item is SelectedExerciseRow => item.exercise_id !== null);
    if (!templateItems.length || selectedItems.length !== templateItems.length) { setTemplateError("Selecciona un ejercicio para cada fila de la plantilla"); return; }
    const payload = { name: templateName.trim(), items: selectedItems.map((item, order_index) => ({ ...item, order_index })) };
    try {
      if (editingTemplateId === null) await createWorkoutTemplate(payload); else await updateWorkoutTemplate(editingTemplateId, payload);
      resetTemplateDraft(); loadData();
    } catch (err) { setTemplateError(apiErrorMessage(err, "No se pudo guardar la plantilla")); }
  }

  async function deleteTemplate(id: number) {
    if (!window.confirm("¿Eliminar esta plantilla? Esta acción no se puede deshacer.")) return;
    await deleteWorkoutTemplate(id); if (editingTemplateId === id) resetTemplateDraft(); loadData();
  }

  async function saveSession(sessionId: number) {
    try { await updateWorkoutSession(sessionId, { sets: expandRows(editingRows) }); setEditingSessionId(null); loadData(); }
    catch (err) { setSessionEditError(apiErrorMessage(err, "No se pudieron guardar los cambios")); }
  }

  const matchingTemplates = name.trim() ? templates.filter((template) => template.name.toLocaleLowerCase("es").includes(name.trim().toLocaleLowerCase("es"))) : [];

  return <div className="space-y-6 pb-8">
    <header className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-white shadow-lg">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Fuerza</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Entrenamientos</h1>
      <p className="mt-2 max-w-xl text-sm text-brand-100">Diseña tu rutina, registra tus series y reutiliza tus mejores plantillas.</p>
    </header>

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <section className="space-y-6 xl:col-span-7">
        <Card title="Nuevo entrenamiento">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nombre<input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del entrenamiento" required className={`mt-1 w-full ${inputClass}`} /></label><label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={`mt-1 w-full ${inputClass}`} /></label></div>
            {matchingTemplates.length > 0 && <div className="rounded-xl border border-brand-100 bg-brand-50 p-3 dark:border-brand-900/50 dark:bg-brand-900/20"><p className="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">Plantillas sugeridas</p><div className="mt-2 flex flex-wrap gap-2">{matchingTemplates.map((template) => <button key={template.id} type="button" onClick={() => hydrateTemplate(template)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm hover:bg-brand-100 dark:bg-slate-800 dark:text-brand-300">Usar “{template.name}”</button>)}</div></div>}
            <ExerciseRows rows={rows} exercises={exercises} onChange={(index, patch) => updateRows(setRows, index, patch)} onRemove={(index) => removeRow(setRows, index)} />
            <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-3 dark:border-brand-900/60 dark:bg-brand-900/10">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">¿Necesitas otra fila?</p>
              <button type="button" onClick={() => addRow(setRows)} disabled={!exercises.length} className="mt-2 rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 disabled:opacity-50 dark:border-brand-700 dark:bg-slate-900 dark:text-brand-300">+ Añadir ejercicio</button>
            </div>
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
              <button type="submit" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-md">Guardar entrenamiento</button>
            </div>
          </form>
        </Card>
        <Card title="Historial">{isLoading ? <p className="text-slate-500">Cargando…</p> : sessions.length === 0 ? <p className="text-slate-500">Aún no registraste entrenamientos.</p> : <div className="space-y-3">{sessions.map((session) => <article key={session.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-slate-900 dark:text-slate-100">{session.name}</h3><p className="text-xs text-slate-500">{new Date(session.date).toLocaleDateString("es-ES")}</p></div><div className="flex gap-3 text-xs font-semibold"><button type="button" onClick={() => { setEditingSessionId(session.id); setEditingRows(collapseSetsToRows(session.sets)); }} className="text-brand-700 dark:text-brand-300">Editar</button><button type="button" onClick={async () => { await deleteWorkoutSession(session.id); loadData(); }} className="text-red-600">Eliminar</button></div></div>{editingSessionId === session.id ? <div className="mt-3 space-y-2"><ExerciseRows rows={editingRows} exercises={exercises} onChange={(index, patch) => updateRows(setEditingRows, index, patch)} onRemove={(index) => removeRow(setEditingRows, index)} /><button type="button" onClick={() => addRow(setEditingRows)} className="text-sm font-semibold text-brand-700 dark:text-brand-300">+ Añadir ejercicio</button>{sessionEditError && <p className="text-sm text-red-600">{sessionEditError}</p>}<div className="flex gap-3"><button type="button" onClick={() => saveSession(session.id)} className="text-sm font-semibold text-brand-700 dark:text-brand-300">Guardar</button><button type="button" onClick={() => setEditingSessionId(null)} className="text-sm text-slate-500">Cancelar</button></div></div> : <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{session.sets.map((set) => set.exercise?.name ?? set.exercise_name).filter((value, index, all) => all.indexOf(value) === index).join(" · ")}</p>}</article>)}</div>}</Card>
      </section>
      <aside className="space-y-6 xl:col-span-5">
        <Card title={editingTemplateId === null ? "Crear plantilla" : "Editar plantilla"}><form onSubmit={saveTemplate} className="space-y-3"><input type="text" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Nombre de la plantilla" className={`w-full ${inputClass}`} /><ExerciseRows rows={templateItems} exercises={exercises} onChange={(index, patch) => updateRows(setTemplateItems, index, patch)} onRemove={(index) => removeRow(setTemplateItems, index)} /><button type="button" onClick={() => addRow(setTemplateItems)} disabled={!exercises.length} className="text-sm font-semibold text-brand-700 dark:text-brand-300">+ Añadir ejercicio</button>{templateError && <p className="text-sm text-red-600">{templateError}</p>}<div className="flex gap-3"><button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">{editingTemplateId === null ? "Guardar plantilla" : "Guardar cambios"}</button>{editingTemplateId !== null && <button type="button" onClick={resetTemplateDraft} className="text-sm font-semibold text-slate-500">Cancelar</button>}</div></form></Card>
        <Card title="Tus plantillas"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">{templates.length === 0 ? <p className="text-sm text-slate-500">Todavía no creaste plantillas.</p> : templates.map((template) => <article key={template.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50"><h3 className="font-bold text-slate-900 dark:text-slate-100">{template.name}</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{template.items.map((item) => `${item.exercise?.name ?? item.exercise_name} ×${item.sets_count}`).join(" · ")}</p><div className="mt-3 flex gap-3 text-xs font-bold"><button type="button" onClick={() => editTemplate(template)} className="text-brand-700 dark:text-brand-300">Editar</button><button type="button" onClick={() => deleteTemplate(template.id)} className="text-red-600">Eliminar</button></div></article>)}</div></Card>
        <Card title="Catálogo de ejercicios"><form onSubmit={handleAddExercise} className="flex gap-2"><input type="text" value={newExerciseName} onChange={(event) => setNewExerciseName(event.target.value)} placeholder="Nuevo ejercicio" className={`min-w-0 flex-1 ${inputClass}`} /><button type="submit" className="rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200">Añadir</button></form>{exerciseError && <p className="mt-2 text-sm text-red-600">{exerciseError}</p>}<div className="mt-3 max-h-72 space-y-1 overflow-auto">{exercises.map((exercise) => editingExerciseId === exercise.id ? <div key={exercise.id} className="flex gap-2"><input autoFocus value={editingExerciseName} onChange={(event) => setEditingExerciseName(event.target.value)} className={`min-w-0 flex-1 ${smallInputClass}`} /><button type="button" onClick={() => saveExerciseName(exercise.id)} className="text-xs font-bold text-brand-700 dark:text-brand-300">Guardar</button><button type="button" onClick={() => setEditingExerciseId(null)} className="text-xs text-slate-500">Cancelar</button></div> : <div key={exercise.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"><span>{exercise.name}</span>{exercise.is_system ? <span className="text-[10px] uppercase tracking-wide text-slate-400">Sistema</span> : <span className="flex gap-2 text-xs font-bold"><button type="button" onClick={() => { setEditingExerciseId(exercise.id); setEditingExerciseName(exercise.name); }} className="text-brand-700 dark:text-brand-300">Editar</button><button type="button" onClick={async () => { try { await deleteExercise(exercise.id); loadData(); } catch (err) { setExerciseError(apiErrorMessage(err, "No se pudo eliminar el ejercicio")); } }} className="text-red-600">Eliminar</button></span>}</div>)}</div></Card>
      </aside>
    </div>
  </div>;
}
