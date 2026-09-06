import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";

import { createFocusSession, deleteFocusSession, listFocusSessions } from "../api/focusSessions";
import FocusTimer from "../components/FocusTimer";
import Card from "../components/ui/Card";
import { useCategories } from "../context/CategoriesContext";
import type { FocusSession } from "../types";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function FocusSessionsPage() {
  const { categories, addCategory, renameCategory, removeCategory } = useCategories();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState(categories[0]);
  const [date, setDate] = useState(todayInputValue());
  const [minutes, setMinutes] = useState(25);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  useEffect(() => {
    if (!categories.includes(category)) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  function loadSessions() {
    setIsLoading(true);
    listFocusSessions()
      .then(setSessions)
      .finally(() => setIsLoading(false));
  }

  useEffect(loadSessions, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (minutes < 1) {
      setError("Los minutos deben ser al menos 1");
      return;
    }
    try {
      const start = new Date(`${date}T12:00:00`);
      const end = new Date(start.getTime() + minutes * 60_000);
      await createFocusSession({
        category,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        notes: notes || undefined,
      });
      setNotes("");
      loadSessions();
    } catch (err) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
      const message = Array.isArray(detail) ? detail[0]?.msg : undefined;
      setError(message || "No se pudo registrar el bloque");
    }
  }

  async function handleDelete(id: number) {
    await deleteFocusSession(id);
    loadSessions();
  }

  function handleAddCategory(event: FormEvent) {
    event.preventDefault();
    addCategory(newCategoryName);
    setNewCategoryName("");
  }

  function startEditCategory(name: string) {
    setEditingCategory(name);
    setEditingCategoryName(name);
  }

  function saveEditCategory() {
    if (editingCategory) {
      renameCategory(editingCategory, editingCategoryName);
    }
    setEditingCategory(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bloques de concentración</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Registra tus sesiones de trabajo profundo</p>
      </div>

      <Card title="Temporizador">
        <FocusTimer onLogged={loadSessions} />
      </Card>

      <Card title="Categorías">
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Nueva categoría"
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="submit"
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Añadir
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((c) =>
            editingCategory === c ? (
              <div key={c} className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 dark:bg-brand-900/30">
                <input
                  autoFocus
                  type="text"
                  value={editingCategoryName}
                  onChange={(e) => setEditingCategoryName(e.target.value)}
                  className="w-32 rounded border border-brand-300 px-1.5 py-0.5 text-xs dark:border-brand-700 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={saveEditCategory}
                  className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingCategory(null)}
                  className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <span
                key={c}
                className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
              >
                {c}
                <button
                  onClick={() => startEditCategory(c)}
                  className="text-brand-500 hover:text-brand-800 dark:text-brand-400"
                  title="Renombrar"
                >
                  ✎
                </button>
                <button
                  onClick={() => removeCategory(c)}
                  disabled={categories.length <= 1}
                  className="text-brand-500 hover:text-red-600 disabled:opacity-40 dark:text-brand-400"
                  title="Eliminar"
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
      </Card>

      <Card title="Nuevo bloque">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fecha</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Minutos</label>
            <input
              type="number"
              min={1}
              required
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              className={`mt-1 w-full ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notas</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`mt-1 w-full ${inputClass}`}
              placeholder="Opcional"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Guardar bloque
            </button>
          </div>
        </form>
      </Card>

      <Card title="Historial">
        {isLoading ? (
          <p className="text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Aún no has registrado bloques de concentración.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2 pr-4">Categoría</th>
                  <th className="py-2 pr-4">Inicio</th>
                  <th className="py-2 pr-4">Fin</th>
                  <th className="py-2 pr-4">Duración</th>
                  <th className="py-2 pr-4">Notas</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{session.category}</td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {new Date(session.start_time).toLocaleString("es-ES")}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">
                      {new Date(session.end_time).toLocaleString("es-ES")}
                    </td>
                    <td className="py-2 pr-4 text-slate-600 dark:text-slate-300">{session.duration_minutes} min</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{session.notes || "—"}</td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
