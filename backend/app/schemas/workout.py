from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ExerciseBase(BaseModel):
    name: str
    muscle_group: str | None = None


class ExerciseCreate(ExerciseBase):
    pass


class ExerciseUpdate(BaseModel):
    name: str | None = None
    muscle_group: str | None = None


class ExerciseRead(ExerciseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class WorkoutSetBase(BaseModel):
    exercise_id: int
    set_number: int = 1
    reps: int = Field(gt=0)
    weight_kg: float = Field(ge=0)
    rpe: float | None = Field(default=None, ge=0, le=10)


class WorkoutSetCreate(WorkoutSetBase):
    pass


class WorkoutSetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workout_session_id: int
    exercise_id: int | None
    exercise_name: str
    set_number: int
    reps: int
    weight_kg: float
    rpe: float | None
    exercise: ExerciseRead | None


class WorkoutSessionBase(BaseModel):
    name: str = "Entrenamiento"
    date: date_type
    notes: str | None = None


class WorkoutSessionCreate(WorkoutSessionBase):
    sets: list[WorkoutSetCreate] = Field(default_factory=list)


class WorkoutSessionUpdate(BaseModel):
    name: str | None = None
    date: date_type | None = None
    notes: str | None = None
    sets: list[WorkoutSetCreate] | None = None


class WorkoutSessionRead(WorkoutSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    sets: list[WorkoutSetRead] = Field(default_factory=list)


class WorkoutTemplateExerciseBase(BaseModel):
    exercise_id: int
    sets_count: int = Field(gt=0)
    order_index: int = 0


class WorkoutTemplateExerciseCreate(WorkoutTemplateExerciseBase):
    pass


class WorkoutTemplateExerciseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    template_id: int
    exercise_id: int
    sets_count: int
    order_index: int
    exercise: ExerciseRead


class WorkoutTemplateBase(BaseModel):
    name: str


class WorkoutTemplateCreate(WorkoutTemplateBase):
    items: list[WorkoutTemplateExerciseCreate] = Field(default_factory=list)


class WorkoutTemplateRead(WorkoutTemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    created_at: datetime
    items: list[WorkoutTemplateExerciseRead] = Field(default_factory=list)


class WorkoutTemplateApply(BaseModel):
    date: date_type
