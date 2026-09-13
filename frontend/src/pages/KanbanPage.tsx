import axios from "axios";
import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";

import { createTask, deleteTask, fetchBoard, moveTask, updateTask } from "../api/kanban";
import Card from "../components/ui/Card";
import type { KanbanBoard, KanbanColumn, KanbanTask } from "../types";

const smallInputClass = "rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";
const DEFAULT_TASK_COLOR = "#e2e8f0";
const moveButtonClass = "rounded px-1.5 py-1 text-xs font-bold leading-none text-slate-700 hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-700";

function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && typeof err.response?.data?.detail === "string") return err.response.data.detail;
  return fallback;
}

function buildMoveAnnouncement(board: KanbanBoard, taskId: number, taskTitle: string): string {
  for (const column of board.columns) {
    const tasksInOrder = [...column.tasks].sort((a, b) => a.position - b.position);
    const index = tasksInOrder.findIndex((task) => task.id === taskId);
    if (index !== -1) {
      return `"${taskTitle}" movida a ${column.name}, posición ${index + 1} de ${tasksInOrder.length}`;
    }
  }
  return `"${taskTitle}" movida`;
}

interface DraggedTaskPayload {
  taskId: number;
  taskTitle: string;
  sourceColumnId: number;
}

function parseDraggedTask(event: DragEvent<HTMLElement>): DraggedTaskPayload | null {
  const raw = event.dataTransfer.getData("application/json");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DraggedTaskPayload;
  } catch {
    return null;
  }
}

interface DropSlotProps {
  slotKey: string;
  isActive: boolean;
  onSlotDragOver: () => void;
  onSlotDragLeave: () => void;
  onSlotDrop: (event: DragEvent<HTMLDivElement>) => void;
}

function DropSlot({ slotKey, isActive, onSlotDragOver, onSlotDragLeave, onSlotDrop }: DropSlotProps) {
  return (
    <div
      data-testid={`drop-slot-${slotKey}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSlotDragOver();
      }}
      onDragLeave={(event) => {
        event.stopPropagation();
        onSlotDragLeave();
      }}
      onDrop={(event) => {
        event.stopPropagation();
        onSlotDrop(event);
      }}
      className={`h-2 rounded-full transition-colors ${isActive ? "bg-brand-400 dark:bg-brand-500" : "bg-transparent"}`}
    />
  );
}

interface MoveTargetColumn {
  id: number;
  name: string;
  taskCount: number;
}

const MOVE_DIRECTIONS = ["prev", "up", "down", "next"] as const;
type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

interface TaskCardProps {
  task: KanbanTask;
  taskIndex: number;
  totalTasksInColumn: number;
  allColumns: MoveTargetColumn[];
  onBoardChange: (board: KanbanBoard) => void;
  onTaskMoved: (board: KanbanBoard, taskId: number, taskTitle: string) => void;
  onBeforeCrossColumnMove: (taskId: number, direction: MoveDirection) => void;
  registerMoveButtonRef: (taskId: number, direction: MoveDirection, el: HTMLButtonElement | null) => void;
}

function TaskCard({
  task,
  taskIndex,
  totalTasksInColumn,
  allColumns,
  onBoardChange,
  onTaskMoved,
  onBeforeCrossColumnMove,
  registerMoveButtonRef,
}: TaskCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [color, setColor] = useState(task.background_color);
  const [error, setError] = useState<string | null>(null);

  const columnIndex = allColumns.findIndex((column) => column.id === task.column_id);
  const isFirstColumn = columnIndex <= 0;
  const isLastColumn = columnIndex === -1 || columnIndex >= allColumns.length - 1;
  const isFirstInColumn = taskIndex <= 0;
  const isLastInColumn = taskIndex >= totalTasksInColumn - 1;

  function handleDragStart(event: DragEvent<HTMLDivElement>) {
    const payload: DraggedTaskPayload = { taskId: task.id, taskTitle: task.title, sourceColumnId: task.column_id };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
  }

  async function handleMoveToAdjacentColumn(direction: "prev" | "next") {
    const destination = allColumns[direction === "prev" ? columnIndex - 1 : columnIndex + 1];
    if (!destination) return;
    onBeforeCrossColumnMove(task.id, direction);
    try {
      const board = await moveTask(task.id, { column_id: destination.id, position: destination.taskCount });
      onTaskMoved(board, task.id, task.title);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo mover la tarea"));
    }
  }

  async function handleReorderWithinColumn(direction: "up" | "down") {
    const targetPosition = direction === "up" ? taskIndex - 1 : taskIndex + 1;
    if (targetPosition < 0 || targetPosition >= totalTasksInColumn) return;
    try {
      const board = await moveTask(task.id, { column_id: task.column_id, position: targetPosition });
      onTaskMoved(board, task.id, task.title);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo mover la tarea"));
    }
  }

  function cancelEdit() {
    setIsEditing(false);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setColor(task.background_color);
    setError(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const board = await updateTask(task.id, {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        background_color: color,
      });
      onBoardChange(board);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo actualizar la tarea"));
    }
  }

  async function handleDelete() {
    try {
      await deleteTask(task.id);
      const board = await fetchBoard();
      onBoardChange(board);
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo eliminar la tarea"));
    }
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      data-testid={`task-${task.id}`}
      style={{ backgroundColor: task.background_color }}
      className="cursor-grab rounded-xl p-3 text-slate-800 shadow-sm active:cursor-grabbing"
    >
      {isEditing ? (
        <form onSubmit={handleSave} className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className={`w-full ${smallInputClass}`}
            aria-label="Título de la tarea"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Descripción (opcional)"
            className={`w-full ${smallInputClass}`}
            aria-label="Descripción de la tarea"
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            className="h-8 w-14 rounded border border-slate-300 dark:border-slate-700"
            aria-label="Color de la tarea"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-3 text-xs font-bold">
            <button type="submit" className="text-brand-700">Guardar</button>
            <button type="button" onClick={cancelEdit} className="text-slate-600">Cancelar</button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm font-semibold text-slate-800">{task.title}</p>
          {task.description && <p className="mt-1 text-xs text-slate-700">{task.description}</p>}
          <div className="mt-2 flex gap-1" role="group" aria-label="Mover tarea">
            <button
              type="button"
              ref={(el) => registerMoveButtonRef(task.id, "prev", el)}
              onClick={() => handleMoveToAdjacentColumn("prev")}
              disabled={isFirstColumn}
              aria-label="Mover a la columna anterior"
              className={moveButtonClass}
            >
              <span aria-hidden="true">◀</span>
            </button>
            <button
              type="button"
              ref={(el) => registerMoveButtonRef(task.id, "up", el)}
              onClick={() => handleReorderWithinColumn("up")}
              disabled={isFirstInColumn}
              aria-label="Subir"
              className={moveButtonClass}
            >
              <span aria-hidden="true">▲</span>
            </button>
            <button
              type="button"
              ref={(el) => registerMoveButtonRef(task.id, "down", el)}
              onClick={() => handleReorderWithinColumn("down")}
              disabled={isLastInColumn}
              aria-label="Bajar"
              className={moveButtonClass}
            >
              <span aria-hidden="true">▼</span>
            </button>
            <button
              type="button"
              ref={(el) => registerMoveButtonRef(task.id, "next", el)}
              onClick={() => handleMoveToAdjacentColumn("next")}
              disabled={isLastColumn}
              aria-label="Mover a la columna siguiente"
              className={moveButtonClass}
            >
              <span aria-hidden="true">▶</span>
            </button>
          </div>
          <div className="mt-2 flex gap-3 text-xs font-bold text-slate-700">
            <button type="button" onClick={() => setIsEditing(true)}>Editar</button>
            <button type="button" onClick={handleDelete} className="text-red-700">Eliminar</button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}

interface AddTaskFormProps {
  columnId: number;
  nextPosition: number;
  onBoardChange: (board: KanbanBoard) => void;
}

function AddTaskForm({ columnId, nextPosition, onBoardChange }: AddTaskFormProps) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState(DEFAULT_TASK_COLOR);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const board = await createTask({
        column_id: columnId,
        position: nextPosition,
        title: title.trim(),
        background_color: color,
      });
      onBoardChange(board);
      setTitle("");
      setColor(DEFAULT_TASK_COLOR);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo crear la tarea"));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Nueva tarea"
        className={`min-w-0 flex-1 ${smallInputClass}`}
        aria-label="Título de la nueva tarea"
      />
      <input
        type="color"
        value={color}
        onChange={(event) => setColor(event.target.value)}
        className="h-9 w-10 shrink-0 rounded border border-slate-300 dark:border-slate-700"
        aria-label="Color de la nueva tarea"
      />
      <button type="submit" className="shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700">Añadir</button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

interface KanbanColumnViewProps {
  column: KanbanColumn;
  allColumns: MoveTargetColumn[];
  onBoardChange: (board: KanbanBoard) => void;
  onTaskMoved: (board: KanbanBoard, taskId: number, taskTitle: string) => void;
  onBeforeCrossColumnMove: (taskId: number, direction: MoveDirection) => void;
  registerMoveButtonRef: (taskId: number, direction: MoveDirection, el: HTMLButtonElement | null) => void;
  dragOverColumnId: number | null;
  setDragOverColumnId: (id: number | null) => void;
  dragOverSlotKey: string | null;
  setDragOverSlotKey: (key: string | null) => void;
}

function KanbanColumnView({
  column,
  allColumns,
  onBoardChange,
  onTaskMoved,
  onBeforeCrossColumnMove,
  registerMoveButtonRef,
  dragOverColumnId,
  setDragOverColumnId,
  dragOverSlotKey,
  setDragOverSlotKey,
}: KanbanColumnViewProps) {
  const [moveError, setMoveError] = useState<string | null>(null);

  function destinationPosition(rawIndex: number, sourceColumnId: number, draggedTaskId: number): number {
    if (sourceColumnId !== column.id) return rawIndex;
    const draggedIndex = column.tasks.findIndex((task) => task.id === draggedTaskId);
    if (draggedIndex === -1) return rawIndex;
    return rawIndex > draggedIndex ? rawIndex - 1 : rawIndex;
  }

  function dropAtIndex(rawIndex: number, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const dragged = parseDraggedTask(event);
    setDragOverColumnId(null);
    setDragOverSlotKey(null);
    if (!dragged) return;
    const position = destinationPosition(rawIndex, dragged.sourceColumnId, dragged.taskId);
    moveTask(dragged.taskId, { column_id: column.id, position })
      .then((board) => {
        onTaskMoved(board, dragged.taskId, dragged.taskTitle);
        setMoveError(null);
      })
      .catch((err) => setMoveError(apiErrorMessage(err, "No se pudo mover la tarea")));
  }

  return (
    <div
      data-testid={`column-${column.key}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOverColumnId(column.id);
      }}
      onDragLeave={() => setDragOverColumnId(dragOverColumnId === column.id ? null : dragOverColumnId)}
      onDrop={(event) => dropAtIndex(column.tasks.length, event)}
      className={`flex min-w-0 flex-col rounded-2xl border p-3 transition-colors ${dragOverColumnId === column.id ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/10" : "border-slate-200 dark:border-slate-800"}`}
    >
      <h3 className="mb-3 flex items-center justify-between text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
        <span>{column.name}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{column.tasks.length}</span>
      </h3>
      <div className="flex flex-col gap-2">
        <DropSlot
          slotKey={`${column.id}:0`}
          isActive={dragOverSlotKey === `${column.id}:0`}
          onSlotDragOver={() => setDragOverSlotKey(`${column.id}:0`)}
          onSlotDragLeave={() => setDragOverSlotKey(null)}
          onSlotDrop={(event) => dropAtIndex(0, event)}
        />
        {column.tasks.map((task, index) => (
          <div key={task.id} className="flex flex-col gap-2">
            <TaskCard
              task={task}
              taskIndex={index}
              totalTasksInColumn={column.tasks.length}
              allColumns={allColumns}
              onBoardChange={onBoardChange}
              onTaskMoved={onTaskMoved}
              onBeforeCrossColumnMove={onBeforeCrossColumnMove}
              registerMoveButtonRef={registerMoveButtonRef}
            />
            <DropSlot
              slotKey={`${column.id}:${index + 1}`}
              isActive={dragOverSlotKey === `${column.id}:${index + 1}`}
              onSlotDragOver={() => setDragOverSlotKey(`${column.id}:${index + 1}`)}
              onSlotDragLeave={() => setDragOverSlotKey(null)}
              onSlotDrop={(event) => dropAtIndex(index + 1, event)}
            />
          </div>
        ))}
      </div>
      {moveError && <p className="mt-2 text-xs text-red-600">{moveError}</p>}
      <AddTaskForm columnId={column.id} nextPosition={column.tasks.length} onBoardChange={onBoardChange} />
    </div>
  );
}

export default function KanbanPage() {
  const [board, setBoard] = useState<KanbanBoard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<number | null>(null);
  const [dragOverSlotKey, setDragOverSlotKey] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pendingFocus, setPendingFocus] = useState<{ taskId: number; direction: MoveDirection } | null>(null);
  const moveButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  function loadData() {
    setIsLoading(true);
    fetchBoard()
      .then((data) => {
        setBoard(data);
        setLoadError(null);
      })
      .catch((err) => setLoadError(apiErrorMessage(err, "No se pudo cargar el tablero")))
      .finally(() => setIsLoading(false));
  }

  useEffect(loadData, []);

  useEffect(() => {
    if (!pendingFocus) return;
    const { taskId, direction } = pendingFocus;
    const candidateDirections = [direction, ...MOVE_DIRECTIONS.filter((candidate) => candidate !== direction)];
    for (const candidate of candidateDirections) {
      const button = moveButtonRefs.current.get(`${taskId}:${candidate}`);
      if (button && !button.disabled) {
        button.focus();
        break;
      }
    }
    setPendingFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);

  function handleTaskMoved(newBoard: KanbanBoard, taskId: number, taskTitle: string) {
    setBoard(newBoard);
    setAnnouncement(buildMoveAnnouncement(newBoard, taskId, taskTitle));
  }

  function registerMoveButtonRef(taskId: number, direction: MoveDirection, el: HTMLButtonElement | null) {
    const key = `${taskId}:${direction}`;
    if (el) {
      moveButtonRefs.current.set(key, el);
    } else {
      moveButtonRefs.current.delete(key);
    }
  }

  const columns = board ? [...board.columns].sort((a, b) => a.position - b.position) : [];
  const allColumns: MoveTargetColumn[] = columns.map((column) => ({ id: column.id, name: column.name, taskCount: column.tasks.length }));

  return (
    <div className="space-y-6 pb-8">
      <header className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-8 text-white shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-100">Productividad</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Kanban</h1>
        <p className="mt-2 max-w-xl text-sm text-brand-100">Organiza tus tareas y arrástralas entre columnas.</p>
      </header>

      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>

      <Card title="Tablero">
        {isLoading ? (
          <p className="text-slate-500">Cargando…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Arrastrá las tarjetas o usá los botones ◀▲▼▶ de cada tarjeta para moverlas entre columnas.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {columns.map((column) => (
                <KanbanColumnView
                  key={column.id}
                  column={column}
                  allColumns={allColumns}
                  onBoardChange={setBoard}
                  onTaskMoved={handleTaskMoved}
                  onBeforeCrossColumnMove={(taskId, direction) => setPendingFocus({ taskId, direction })}
                  registerMoveButtonRef={registerMoveButtonRef}
                  dragOverColumnId={dragOverColumnId}
                  setDragOverColumnId={setDragOverColumnId}
                  dragOverSlotKey={dragOverSlotKey}
                  setDragOverSlotKey={setDragOverSlotKey}
                />
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
