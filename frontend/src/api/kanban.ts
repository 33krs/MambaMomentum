import apiClient from "./client";
import type { KanbanBoard, KanbanTaskInput, KanbanTaskMoveInput, KanbanTaskUpdateInput } from "../types";

export async function fetchBoard(): Promise<KanbanBoard> {
  const { data } = await apiClient.get<KanbanBoard>("/kanban/");
  return data;
}

export async function createTask(input: KanbanTaskInput): Promise<KanbanBoard> {
  const { data } = await apiClient.post<KanbanBoard>("/kanban/tasks", input);
  return data;
}

export async function updateTask(id: number, patch: KanbanTaskUpdateInput): Promise<KanbanBoard> {
  const { data } = await apiClient.patch<KanbanBoard>(`/kanban/tasks/${id}`, patch);
  return data;
}

export async function moveTask(id: number, move: KanbanTaskMoveInput): Promise<KanbanBoard> {
  const { data } = await apiClient.patch<KanbanBoard>(`/kanban/tasks/${id}/move`, move);
  return data;
}

export async function deleteTask(id: number): Promise<void> {
  await apiClient.delete(`/kanban/tasks/${id}`);
}
