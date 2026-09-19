import { beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "./client";
import { archiveHabit, createHabit, fetchHabitStats, listHabits, markHabit, unmarkHabit, updateHabit } from "./habits";

vi.mock("./client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedClient = vi.mocked(apiClient, true);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("habits api", () => {
  it("lists habits including archived items when requested", async () => {
    const habits = [{ id: 1, name: "Leer" }];
    mockedClient.get.mockResolvedValueOnce({ data: habits });

    await expect(listHabits(true)).resolves.toEqual(habits);
    expect(mockedClient.get).toHaveBeenCalledWith("/habits/", { params: { include_archived: true } });
  });

  it("creates and updates a habit with the supplied payload", async () => {
    const habit = { id: 1, name: "Leer" };
    mockedClient.post.mockResolvedValueOnce({ data: habit });
    mockedClient.patch.mockResolvedValueOnce({ data: habit });

    await expect(createHabit({ name: "Leer", color: "#2563eb" })).resolves.toEqual(habit);
    await expect(updateHabit(1, { name: "Leer más" })).resolves.toEqual(habit);

    expect(mockedClient.post).toHaveBeenCalledWith("/habits/", { name: "Leer", color: "#2563eb" });
    expect(mockedClient.patch).toHaveBeenCalledWith("/habits/1", { name: "Leer más" });
  });

  it("archives a habit through its status update", async () => {
    mockedClient.patch.mockResolvedValueOnce({ data: { id: 1 } });

    await archiveHabit(1);

    expect(mockedClient.patch).toHaveBeenCalledWith("/habits/1", { status: "archived" });
  });

  it("marks today without a date and historical dates with their payload", async () => {
    mockedClient.post.mockResolvedValue({});

    await markHabit(1);
    await markHabit(1, "2026-09-16");

    expect(mockedClient.post).toHaveBeenNthCalledWith(1, "/habits/1/logs", undefined);
    expect(mockedClient.post).toHaveBeenNthCalledWith(2, "/habits/1/logs", { date: "2026-09-16" });
  });

  it("unmarks a habit using the date query parameter", async () => {
    mockedClient.delete.mockResolvedValueOnce({});

    await unmarkHabit(1, "2026-09-16");

    expect(mockedClient.delete).toHaveBeenCalledWith("/habits/1/logs", { params: { date: "2026-09-16" } });
  });

  it("fetches the server-calculated weekly stats", async () => {
    const stats = { start: "2026-09-14", end: "2026-09-19" };
    mockedClient.get.mockResolvedValueOnce({ data: stats });

    await expect(fetchHabitStats()).resolves.toEqual(stats);
    expect(mockedClient.get).toHaveBeenCalledWith("/habits/stats");
  });
});
