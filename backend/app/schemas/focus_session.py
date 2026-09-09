from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class FocusSessionBase(BaseModel):
    category: str = "General"
    start_time: datetime
    end_time: datetime
    notes: str | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def times_must_include_timezone(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("time values must include a timezone")
        return value

    @model_validator(mode="after")
    def check_time_range(self) -> "FocusSessionBase":
        if self.end_time <= self.start_time:
            raise ValueError("end_time debe ser posterior a start_time")
        return self


class FocusSessionCreate(FocusSessionBase):
    pass


class FocusSessionUpdate(BaseModel):
    category: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    notes: str | None = None

    @field_validator("start_time", "end_time")
    @classmethod
    def times_must_include_timezone(cls, value: datetime | None) -> datetime:
        if value is None:
            raise ValueError("time values cannot be null")
        if value.utcoffset() is None:
            raise ValueError("time values must include a timezone")
        return value


class FocusSessionRead(FocusSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    duration_minutes: int
    created_at: datetime
