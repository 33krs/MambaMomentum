import apiClient from "./client";
import type { FocusSession, FocusSessionInput } from "../types";

export async function listFocusSessions(): Promise<FocusSession[]> {
  const { data } = await apiClient.get<FocusSession[]>("/focus-sessions/");
  return data;
}

export async function createFocusSession(input: FocusSessionInput): Promise<FocusSession> {
  const { data } = await apiClient.post<FocusSession>("/focus-sessions/", input);
  return data;
}

export async function deleteFocusSession(id: number): Promise<void> {
  await apiClient.delete(`/focus-sessions/${id}`);
}
