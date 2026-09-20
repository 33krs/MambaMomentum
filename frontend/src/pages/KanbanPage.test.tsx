import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

import * as kanbanApi from "../api/kanban";
import type { KanbanBoard } from "../types";
import KanbanPage from "./KanbanPage";

vi.mock("../api/kanban", () => ({
  fetchBoard: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
}));

const mockedApi = vi.mocked(kanbanApi, true);

function makeBoard(overrides?: Partial<KanbanBoard>): KanbanBoard {
  return {
    id: 1,
    columns: [
      {
        id: 10,
        key: "todo",
        name: "Por hacer",
        position: 0,
        tasks: [
          {
            id: 100,
            column_id: 10,
            title: "Tarea A",
            description: null,
            background_color: "#e2e8f0",
            position: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      { id: 11, key: "doing", name: "En curso", position: 1, tasks: [] },
      { id: 12, key: "done", name: "Hecho", position: 2, tasks: [] },
    ],
    ...overrides,
  };
}

function makeMultiTaskBoard(): KanbanBoard {
  return {
    id: 1,
    columns: [
      {
        id: 10,
        key: "todo",
        name: "Por hacer",
        position: 0,
        tasks: [
          {
            id: 100,
            column_id: 10,
            title: "Tarea A",
            description: null,
            background_color: "#e2e8f0",
            position: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            id: 101,
            column_id: 10,
            title: "Tarea B",
            description: null,
            background_color: "#e2e8f0",
            position: 1,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
      { id: 11, key: "doing", name: "En curso", position: 1, tasks: [] },
      {
        id: 12,
        key: "done",
        name: "Hecho",
        position: 2,
        tasks: [
          {
            id: 102,
            column_id: 12,
            title: "Tarea C",
            description: null,
            background_color: "#e2e8f0",
            position: 0,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
      },
    ],
  };
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <KanbanPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("KanbanPage", () => {
  it("renders columns and tasks from the loaded board", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeBoard());

    renderPage();

    expect(await screen.findByText("Tarea A")).toBeInTheDocument();
    expect(within(screen.getByTestId("column-todo")).getByText("Por hacer")).toBeInTheDocument();
    expect(within(screen.getByTestId("column-doing")).getByText("En curso")).toBeInTheDocument();
    expect(within(screen.getByTestId("column-done")).getByText("Hecho")).toBeInTheDocument();
  });

  it("submits the add-task form with the expected payload and re-renders with the returned board", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeBoard());
    const boardAfterCreate = makeBoard();
    boardAfterCreate.columns[0].tasks.push({
      id: 101,
      column_id: 10,
      title: "Tarea B",
      description: null,
      background_color: "#e2e8f0",
      position: 1,
      created_at: "2026-01-02T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });
    mockedApi.createTask.mockResolvedValueOnce(boardAfterCreate);

    renderPage();
    await screen.findByText("Tarea A");

    const todoColumn = screen.getByTestId("column-todo");
    const titleInput = within(todoColumn).getByPlaceholderText("Nueva tarea");
    fireEvent.change(titleInput, { target: { value: "Tarea B" } });
    fireEvent.click(within(todoColumn).getByRole("button", { name: "Añadir" }));

    await waitFor(() => {
      expect(mockedApi.createTask).toHaveBeenCalledWith({
        column_id: 10,
        position: 1,
        title: "Tarea B",
        background_color: "#e2e8f0",
      });
    });
    expect(await screen.findByText("Tarea B")).toBeInTheDocument();
  });

  it("calls deleteTask and reloads the board when a card is deleted", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeBoard());
    mockedApi.deleteTask.mockResolvedValueOnce(undefined);
    mockedApi.fetchBoard.mockResolvedValueOnce(makeBoard({ columns: [
      { id: 10, key: "todo", name: "Por hacer", position: 0, tasks: [] },
      { id: 11, key: "doing", name: "En curso", position: 1, tasks: [] },
      { id: 12, key: "done", name: "Hecho", position: 2, tasks: [] },
    ] }));

    renderPage();
    await screen.findByText("Tarea A");

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(mockedApi.deleteTask).toHaveBeenCalledWith(100));
    await waitFor(() => expect(screen.queryByText("Tarea A")).not.toBeInTheDocument());
  });

  it("moves a task via native drag-and-drop and calls moveTask with the expected destination", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeBoard());
    mockedApi.moveTask.mockResolvedValueOnce(makeBoard());

    renderPage();
    await screen.findByText("Tarea A");

    const card = screen.getByTestId("task-100");
    const doingColumn = screen.getByTestId("column-doing");

    const dataTransfer = {
      store: {} as Record<string, string>,
      setData(format: string, value: string) {
        this.store[format] = value;
      },
      getData(format: string) {
        return this.store[format] ?? "";
      },
      effectAllowed: "",
    };

    fireEvent.dragStart(card, { dataTransfer });
    fireEvent.drop(doingColumn, { dataTransfer });

    await waitFor(() => {
      expect(mockedApi.moveTask).toHaveBeenCalledWith(100, { column_id: 11, position: 0 });
    });
  });

  it("renders the move-task buttons with correct aria-labels and disables them at column/position boundaries", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeMultiTaskBoard());

    renderPage();
    await screen.findByText("Tarea A");

    const taskA = within(screen.getByTestId("task-100"));
    expect(taskA.getByRole("button", { name: "Mover a la columna anterior" })).toBeDisabled();
    expect(taskA.getByRole("button", { name: "Mover a la columna siguiente" })).not.toBeDisabled();
    expect(taskA.getByRole("button", { name: "Subir" })).toBeDisabled();
    expect(taskA.getByRole("button", { name: "Bajar" })).not.toBeDisabled();

    const taskB = within(screen.getByTestId("task-101"));
    expect(taskB.getByRole("button", { name: "Mover a la columna anterior" })).toBeDisabled();
    expect(taskB.getByRole("button", { name: "Mover a la columna siguiente" })).not.toBeDisabled();
    expect(taskB.getByRole("button", { name: "Subir" })).not.toBeDisabled();
    expect(taskB.getByRole("button", { name: "Bajar" })).toBeDisabled();

    const taskC = within(screen.getByTestId("task-102"));
    expect(taskC.getByRole("button", { name: "Mover a la columna anterior" })).not.toBeDisabled();
    expect(taskC.getByRole("button", { name: "Mover a la columna siguiente" })).toBeDisabled();
    expect(taskC.getByRole("button", { name: "Subir" })).toBeDisabled();
    expect(taskC.getByRole("button", { name: "Bajar" })).toBeDisabled();
  });

  it("calls moveTask with the adjacent column and end position when the next-column button is clicked", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeMultiTaskBoard());
    mockedApi.moveTask.mockResolvedValueOnce(makeMultiTaskBoard());

    renderPage();
    await screen.findByText("Tarea A");

    const taskA = within(screen.getByTestId("task-100"));
    fireEvent.click(taskA.getByRole("button", { name: "Mover a la columna siguiente" }));

    await waitFor(() => {
      expect(mockedApi.moveTask).toHaveBeenCalledWith(100, { column_id: 11, position: 0 });
    });
  });

  it("calls moveTask with the same column and adjacent position when the down button is clicked", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeMultiTaskBoard());
    mockedApi.moveTask.mockResolvedValueOnce(makeMultiTaskBoard());

    renderPage();
    await screen.findByText("Tarea A");

    const taskA = within(screen.getByTestId("task-100"));
    fireEvent.click(taskA.getByRole("button", { name: "Bajar" }));

    await waitFor(() => {
      expect(mockedApi.moveTask).toHaveBeenCalledWith(100, { column_id: 10, position: 1 });
    });
  });

  it("updates the live region with the task title and destination after a successful move", async () => {
    mockedApi.fetchBoard.mockResolvedValueOnce(makeMultiTaskBoard());
    const boardAfterMove = makeMultiTaskBoard();
    boardAfterMove.columns[0].tasks = [
      { id: 101, column_id: 10, title: "Tarea B", description: null, background_color: "#e2e8f0", position: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    ];
    boardAfterMove.columns[1].tasks = [
      { id: 100, column_id: 11, title: "Tarea A", description: null, background_color: "#e2e8f0", position: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    ];
    mockedApi.moveTask.mockResolvedValueOnce(boardAfterMove);

    renderPage();
    await screen.findByText("Tarea A");

    const taskA = within(screen.getByTestId("task-100"));
    fireEvent.click(taskA.getByRole("button", { name: "Mover a la columna siguiente" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("Tarea A");
    });
    expect(screen.getByRole("status").textContent).toContain("En curso");
    expect(screen.getByRole("status").textContent).toContain("posición 1 de 1");
  });
});
