import apiClient from "./client";
import type { Habit, HabitInput, HabitStats, HabitUpdateInput } from "../types";

export async function listHabits(includeArchived = false): Promise<Habit[]> {
  const { data } = await apiClient.get<Habit[]>("/habits/", { params: { include_archived: includeArchived } });
  return data;
}

export async function createHabit(input: HabitInput): Promise<Habit> {
  const { data } = await apiClient.post<Habit>("/habits/", input);
  return data;
}

export async function updateHabit(id: number, patch: HabitUpdateInput): Promise<Habit> {
  const { data } = await apiClient.patch<Habit>(`/habits/${id}`, patch);
  return data;
}

export async function archiveHabit(id: number): Promise<Habit> {
  return updateHabit(id, { status: "archived" });
}

export async function markHabit(id: number, date?: string): Promise<void> {
  await apiClient.post(`/habits/${id}/logs`, date ? { date } : undefined);
}

export async function unmarkHabit(id: number, date: string): Promise<void> {
  await apiClient.delete(`/habits/${id}/logs`, { params: { date } });
}

export async function fetchHabitStats(): Promise<HabitStats> {
  const { data } = await apiClient.get<HabitStats>("/habits/stats");
  return data;
}
