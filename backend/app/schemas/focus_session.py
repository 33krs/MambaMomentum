from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class FocusSessionBase(BaseModel):
    category: str = "General"
    start_time: datetime
    end_time: datetime
    notes: str | None = None

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


class FocusSessionRead(FocusSessionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    duration_minutes: int
    created_at: datetime
