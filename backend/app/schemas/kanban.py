from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class KanbanTaskCreate(BaseModel):
    """Input for adding a task to one of the authenticated user's columns."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    column_id: int = Field(gt=0)
    position: int = Field(ge=0)
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    background_color: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")


class KanbanTaskUpdate(BaseModel):
    """Content-only partial update; moving a task has its own explicit command."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    background_color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")

    @model_validator(mode="after")
    def requires_content(self) -> "KanbanTaskUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one task content field is required")
        return self

    @field_validator("title", "background_color")
    @classmethod
    def required_content_cannot_be_null(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("task content fields cannot be null")
        return value


class KanbanTaskMove(BaseModel):
    model_config = ConfigDict(extra="forbid")

    column_id: int = Field(gt=0)
    position: int = Field(ge=0)


class KanbanTaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    column_id: int
    title: str
    description: str | None
    background_color: str
    position: int
    created_at: datetime
    updated_at: datetime


class KanbanColumnRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    name: str
    position: int
    tasks: list[KanbanTaskRead] = Field(default_factory=list)


class KanbanBoardRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    columns: list[KanbanColumnRead] = Field(default_factory=list)
