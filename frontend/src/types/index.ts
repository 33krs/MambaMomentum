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
  is_system: boolean;
}

export interface ExerciseInput {
  name?: string;
  muscle_group?: string | null;
}

export interface WorkoutSet {
  id: number;
  workout_session_id: number;
  exercise_id: number | null;
  exercise_name: string;
  set_number: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  exercise: Exercise | null;
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

export interface WorkoutSessionUpdateInput {
  name?: string;
  date?: string;
  notes?: string;
  sets?: WorkoutSetInput[];
}

export interface WorkoutTemplateExercise {
  id: number;
  template_id: number;
  exercise_id: number | null;
  exercise_name: string;
  sets_count: number;
  order_index: number;
  exercise: Exercise | null;
}

export interface WorkoutTemplateExerciseInput {
  exercise_id: number;
  sets_count: number;
  order_index: number;
}

export interface WorkoutTemplate {
  id: number;
  user_id: number;
  name: string;
  created_at: string;
  items: WorkoutTemplateExercise[];
}

export interface WorkoutTemplateInput {
  name: string;
  items: WorkoutTemplateExerciseInput[];
}

export interface HeatmapPoint {
  date: string;
  value: number;
  trained: boolean;
}

export interface TrendPoint {
  period_start: string;
  total_minutes: number;
  session_count: number;
  avg_session_minutes: number;
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

export interface KanbanTask {
  id: number;
  column_id: number;
  title: string;
  description: string | null;
  background_color: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanColumn {
  id: number;
  key: string;
  name: string;
  position: number;
  tasks: KanbanTask[];
}

export interface KanbanBoard {
  id: number;
  columns: KanbanColumn[];
}

export interface KanbanTaskInput {
  column_id: number;
  position: number;
  title: string;
  description?: string | null;
  background_color: string;
}

export interface KanbanTaskUpdateInput {
  title?: string;
  description?: string | null;
  background_color?: string;
}

export interface KanbanTaskMoveInput {
  column_id: number;
  position: number;
}
