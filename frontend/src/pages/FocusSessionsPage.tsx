import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";

import { createFocusSession, deleteFocusSession, listFocusSessions } from "../api/focusSessions";
import Card from "../components/ui/Card";
import type { FocusSession } from "../types";

const CATEGORIES = ["Trabajo", "Estudio", "Proyecto Personal", "Lectura", "General"];

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function FocusSessionsPage() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startTime, setStartTime] = useState(toLocalInputValue(new Date(Date.now() - 25 * 60_000)));
  const [endTime, setEndTime] = useState(toLocalInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    try {
      await createFocusSession({
        category,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bloques de concentración</h1>
        <p className="text-sm text-slate-500">Registra tus sesiones de trabajo profundo</p>
      </div>

      <Card title="Nuevo bloque">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Inicio</label>
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Fin</label>
            <input
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Notas</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
          <p className="text-slate-500">Cargando…</p>
        ) : sessions.length === 0 ? (
          <p className="text-slate-500">Aún no has registrado bloques de concentración.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
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
                  <tr key={session.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{session.category}</td>
                    <td className="py-2 pr-4 text-slate-600">
                      {new Date(session.start_time).toLocaleString("es-ES")}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">
                      {new Date(session.end_time).toLocaleString("es-ES")}
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{session.duration_minutes} min</td>
                    <td className="py-2 pr-4 text-slate-500">{session.notes || "—"}</td>
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
