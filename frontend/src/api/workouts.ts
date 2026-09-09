import apiClient from "./client";
import type {
  Exercise,
  ExerciseInput,
  WorkoutSession,
  WorkoutSessionInput,
  WorkoutSessionUpdateInput,
  WorkoutTemplate,
  WorkoutTemplateInput,
} from "../types";

export async function listExercises(): Promise<Exercise[]> {
  const { data } = await apiClient.get<Exercise[]>("/workouts/exercises");
  return data;
}

export async function createExercise(name: string, muscleGroup?: string): Promise<Exercise> {
  const { data } = await apiClient.post<Exercise>("/workouts/exercises", {
    name,
    muscle_group: muscleGroup || null,
  });
  return data;
}

export async function updateExercise(id: number, patch: ExerciseInput): Promise<Exercise> {
  const { data } = await apiClient.put<Exercise>(`/workouts/exercises/${id}`, patch);
  return data;
}

export async function deleteExercise(id: number): Promise<void> {
  await apiClient.delete(`/workouts/exercises/${id}`);
}

export async function listWorkoutSessions(): Promise<WorkoutSession[]> {
  const { data } = await apiClient.get<WorkoutSession[]>("/workouts/");
  return data;
}

export async function createWorkoutSession(input: WorkoutSessionInput): Promise<WorkoutSession> {
  const { data } = await apiClient.post<WorkoutSession>("/workouts/", input);
  return data;
}

export async function updateWorkoutSession(
  id: number,
  patch: WorkoutSessionUpdateInput,
): Promise<WorkoutSession> {
  const { data } = await apiClient.put<WorkoutSession>(`/workouts/${id}`, patch);
  return data;
}

export async function deleteWorkoutSession(id: number): Promise<void> {
  await apiClient.delete(`/workouts/${id}`);
}

export async function listWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  const { data } = await apiClient.get<WorkoutTemplate[]>("/workouts/templates");
  return data;
}

export async function createWorkoutTemplate(input: WorkoutTemplateInput): Promise<WorkoutTemplate> {
  const { data } = await apiClient.post<WorkoutTemplate>("/workouts/templates", input);
  return data;
}

export async function updateWorkoutTemplate(
  id: number,
  patch: WorkoutTemplateInput,
): Promise<WorkoutTemplate> {
  const { data } = await apiClient.put<WorkoutTemplate>(`/workouts/templates/${id}`, patch);
  return data;
}

export async function deleteWorkoutTemplate(id: number): Promise<void> {
  await apiClient.delete(`/workouts/templates/${id}`);
}

export async function applyWorkoutTemplate(id: number, date: string): Promise<WorkoutSession> {
  const { data } = await apiClient.post<WorkoutSession>(`/workouts/templates/${id}/apply`, { date });
  return data;
}
