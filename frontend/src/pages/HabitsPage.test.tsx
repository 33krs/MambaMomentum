import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as habitsApi from "../api/habits";
import type { Habit, HabitStats } from "../types";
import HabitsPage from "./HabitsPage";

vi.mock("../api/habits", () => ({
  archiveHabit: vi.fn(),
  createHabit: vi.fn(),
  fetchHabitStats: vi.fn(),
  listHabits: vi.fn(),
  markHabit: vi.fn(),
  unmarkHabit: vi.fn(),
  updateHabit: vi.fn(),
}));

const mockedApi = vi.mocked(habitsApi, true);

const stats: HabitStats = {
  start: "2026-09-14",
  end: "2026-09-19",
  active_habits: 1,
  elapsed_days: 6,
  completed: 3,
  percentage: 50,
  current_streak_days: 2,
};

function makeHabit(overrides?: Partial<Habit>): Habit {
  return {
    id: 1,
    user_id: 1,
    name: "Leer",
    color: "#2563eb",
    status: "active",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    logs: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <HabitsPage />
    </MemoryRouter>
  );
}

function mockInitialLoad(habits: Habit[] = [makeHabit()]) {
  mockedApi.listHabits.mockResolvedValue(habits);
  mockedApi.fetchHabitStats.mockResolvedValue(stats);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("HabitsPage", () => {
  it("renders active habits and the API weekly summary", async () => {
    mockInitialLoad();

    renderPage();

    expect(await screen.findByText("Leer")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("3 completados de 6 posibles")).toBeInTheDocument();
  });

  it("creates a habit from the labelled form", async () => {
    mockInitialLoad();
    mockedApi.createHabit.mockResolvedValueOnce(makeHabit({ id: 2, name: "Meditar" }));

    renderPage();
    await screen.findByText("Leer");

    fireEvent.change(screen.getByLabelText("Nombre del hábito"), { target: { value: "Meditar" } });
    fireEvent.click(screen.getByRole("button", { name: "Añadir hábito" }));

    await waitFor(() => expect(mockedApi.createHabit).toHaveBeenCalledWith({ name: "Meditar", color: "#2563eb" }));
  });

  it("marks a historical selected date with the date payload", async () => {
    mockInitialLoad();
    mockedApi.markHabit.mockResolvedValueOnce(undefined);

    renderPage();
    await screen.findByText("Leer");

    fireEvent.change(screen.getByLabelText("Fecha a registrar"), { target: { value: "2026-09-16" } });
    fireEvent.click(within(screen.getByLabelText("Hábitos activos")).getByRole("button", { name: "Marcar" }));

    await waitFor(() => expect(mockedApi.markHabit).toHaveBeenCalledWith(1, "2026-09-16"));
  });

  it("does not allow marking a future date", async () => {
    mockInitialLoad();

    renderPage();
    await screen.findByText("Leer");

    fireEvent.change(screen.getByLabelText("Fecha a registrar"), { target: { value: "2026-09-20" } });

    expect(within(screen.getByLabelText("Hábitos activos")).getByRole("button", { name: "Marcar" })).toBeDisabled();
    expect(mockedApi.markHabit).not.toHaveBeenCalled();
  });

  it("edits and archives habits through accessible controls", async () => {
    mockInitialLoad();
    mockedApi.updateHabit.mockResolvedValueOnce(makeHabit({ name: "Leer un capítulo" }));
    mockedApi.archiveHabit.mockResolvedValueOnce(makeHabit({ status: "archived" }));

    renderPage();
    await screen.findByText("Leer");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nombre del hábito"), { target: { value: "Leer un capítulo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(mockedApi.updateHabit).toHaveBeenCalledWith(1, { name: "Leer un capítulo", color: "#2563eb" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Archivar" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    await waitFor(() => expect(mockedApi.archiveHabit).toHaveBeenCalledWith(1));
  });

  it("focuses the edit dialog and restores focus after Escape", async () => {
    mockInitialLoad();

    renderPage();
    await screen.findByText("Leer");

    const editButton = screen.getByRole("button", { name: "Editar" });
    editButton.focus();
    fireEvent.click(editButton);
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getByLabelText("Nombre del hábito")).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(editButton).toHaveFocus();
  });
});
