import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.base import _utcnow


class AuditLogAction(str, enum.Enum):
    USER_ROLE_CHANGE = "user_role_change"
    USER_STATUS_CHANGE = "user_status_change"
    USER_UPDATE = "user_update"
    USER_DELETE = "user_delete"
    PROBLEM_CREATE = "problem_create"
    PROBLEM_UPDATE = "problem_update"
    PROBLEM_STATUS_CHANGE = "problem_status_change"
    PROBLEM_DELETE = "problem_delete"
    ADMIN_ACTION = "admin_action"
    MODERATOR_ACTION = "moderator_action"
    AUTH_LOGIN = "auth_login"
    SECURITY_VIOLATION = "security_violation"


class AuditLogStatus(str, enum.Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    ERROR = "error"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    actor_username: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    actor_role: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    target_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    target_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default=AuditLogStatus.SUCCESS.value,
        nullable=False,
        index=True,
    )
    details: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
        index=True,
    )
