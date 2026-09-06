import apiClient from "./client";
import type { DashboardSummary, HeatmapPoint, TrendPoint, VolumePoint } from "../types";

export async function fetchSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummary>("/analytics/summary");
  return data;
}

export async function fetchFocusHeatmap(days = 180): Promise<HeatmapPoint[]> {
  const { data } = await apiClient.get<HeatmapPoint[]>("/analytics/focus/heatmap", {
    params: { days },
  });
  return data;
}

export async function fetchFocusTrends(weeks = 12): Promise<TrendPoint[]> {
  const { data } = await apiClient.get<TrendPoint[]>("/analytics/focus/trends", {
    params: { weeks },
  });
  return data;
}

export async function fetchWorkoutVolume(weeks = 12): Promise<VolumePoint[]> {
  const { data } = await apiClient.get<VolumePoint[]>("/analytics/workouts/volume", {
    params: { weeks },
  });
  return data;
}
