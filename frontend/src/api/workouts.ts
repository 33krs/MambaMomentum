import apiClient from "./client";
import type { Exercise, WorkoutSession, WorkoutSessionInput } from "../types";

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

export async function listWorkoutSessions(): Promise<WorkoutSession[]> {
  const { data } = await apiClient.get<WorkoutSession[]>("/workouts/");
  return data;
}

export async function createWorkoutSession(input: WorkoutSessionInput): Promise<WorkoutSession> {
  const { data } = await apiClient.post<WorkoutSession>("/workouts/", input);
  return data;
}

export async function deleteWorkoutSession(id: number): Promise<void> {
  await apiClient.delete(`/workouts/${id}`);
}
