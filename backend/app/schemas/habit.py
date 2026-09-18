from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HabitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")


class HabitUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    status: str | None = Field(default=None, pattern=r"^(active|archived)$")


class HabitLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    habit_id: int
    date: date_type
    created_at: datetime


class HabitLogCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date_type | None = None


class HabitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    color: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    logs: list[HabitLogRead] = Field(default_factory=list)


class HabitStats(BaseModel):
    start: date_type
    end: date_type
    active_habits: int
    elapsed_days: int
    completed: int
    percentage: float
    current_streak_days: int
