export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FocusSession {
  id: number;
  user_id: number;
  category: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  notes: string | null;
  created_at: string;
}

export interface FocusSessionInput {
  category: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export interface Exercise {
  id: number;
  name: string;
  muscle_group: string | null;
}

export interface WorkoutSet {
  id: number;
  workout_session_id: number;
  exercise_id: number;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  exercise: Exercise;
}

export interface WorkoutSetInput {
  exercise_id: number;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe?: number | null;
}

export interface WorkoutSession {
  id: number;
  user_id: number;
  name: string;
  date: string;
  notes: string | null;
  created_at: string;
  sets: WorkoutSet[];
}

export interface WorkoutSessionInput {
  name: string;
  date: string;
  notes?: string;
  sets: WorkoutSetInput[];
}

export interface HeatmapPoint {
  date: string;
  value: number;
}

export interface TrendPoint {
  period_start: string;
  total_minutes: number;
  session_count: number;
}

export interface VolumePoint {
  period_start: string;
  total_volume_kg: number;
  total_sets: number;
}

export interface DashboardSummary {
  focus_minutes_last_7_days: number;
  focus_sessions_last_7_days: number;
  workout_sessions_last_7_days: number;
  workout_volume_last_7_days_kg: number;
  current_focus_streak_days: number;
}
