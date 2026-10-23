import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.config import settings
from app.database import SessionLocal
from app.models.audit_log import AuditLog, AuditLogStatus

SENSITIVE_KEYS = {
    "password",
    "password_hash",
    "plain_password",
    "token",
    "access_token",
    "refresh_token",
    "otp",
    "secret",
    "authorization",
    "api_key",
    "credit_card",
}

_audit_sink_id: int | None = None


def to_str_val(val: object) -> str:
    """Safely converts enum, string, or arbitrary value to string representation."""
    if val is None:
        return ""
    if hasattr(val, "value"):
        return str(val.value)
    return str(val)


def sanitize_details(data: object) -> object:
    """Recursively scrub sensitive fields like passwords, tokens, and OTPs."""
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if any(sensitive in str(k).lower() for sensitive in SENSITIVE_KEYS):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = sanitize_details(v)
        return cleaned
    elif isinstance(data, (list, tuple)):
        return [sanitize_details(item) for item in data]
    return data


def setup_audit_logger(
    log_file: str | Path | None = None,
    rotation: str | None = None,
    retention: str | None = None,
    level: str = "INFO",
) -> int:
    """Configures file-based logging for audit events using loguru with rotation and retention.

    Prevents duplicate log entries by tracking and removing previous audit sinks.
    """
    global _audit_sink_id
    file_path = Path(log_file or settings.LOG_FILE_PATH)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    rot = rotation or settings.LOG_ROTATION
    ret = retention or settings.LOG_RETENTION

    # Deduplication: remove existing sink if already registered
    if _audit_sink_id is not None:
        try:
            logger.remove(_audit_sink_id)
        except ValueError:
            pass
        _audit_sink_id = None

    sink_id = logger.add(
        str(file_path),
        filter=lambda record: record["extra"].get("audit", False) is True,
        rotation=rot,
        retention=ret,
        level=level,
        format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level} | {extra[audit_action]} | {message}",
        enqueue=False,  # Thread-safe synchronous write avoiding multiprocessing semaphore leaks on reloads
    )
    _audit_sink_id = sink_id
    return sink_id


async def log_audit_event(
    db: AsyncSession | None = None,
    *,
    action: str,
    actor: Any | None = None,
    request: Any | None = None,
    actor_id: uuid.UUID | None = None,
    actor_username: str | None = None,
    actor_role: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
    status: str = AuditLogStatus.SUCCESS.value,
    details: dict[str, Any] | None = None,
    error_message: str | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Records an audit event in both loguru file-based storage and the database.

    Guarantees:
    - Sensitive information (passwords, tokens, OTPs) is scrubbed.
    - Loguru writes to file with structured metadata.
    - Audit entry is saved in the database even on failure paths.
    """
    if actor is not None:
        if actor_id is None:
            actor_id = getattr(actor, "id", None)
        if actor_username is None:
            actor_username = str(getattr(actor, "username", ""))
        if actor_role is None:
            actor_role = to_str_val(getattr(actor, "role", None))
    if request is not None and ip_address is None:
        client = getattr(request, "client", None)
        ip_address = client.host if client else None

    sanitized_details = sanitize_details(details) if details else None

    # 1. File-based logging with loguru
    log_extra = {
        "audit": True,
        "audit_action": action,
        "actor": actor_username or (str(actor_id) if actor_id else "anonymous"),
        "target": f"{target_type}:{target_id}" if target_type else "system",
        "status": status,
    }

    log_entry_payload = {
        "timestamp": datetime.now(UTC).isoformat(),
        "action": action,
        "actor_id": str(actor_id) if actor_id else None,
        "actor_username": actor_username,
        "actor_role": actor_role,
        "target_type": target_type,
        "target_id": target_id,
        "status": status,
        "details": sanitized_details,
        "error_message": error_message,
        "ip_address": ip_address,
    }
    json_msg = json.dumps(log_entry_payload, default=str)

    if status == AuditLogStatus.SUCCESS.value:
        logger.bind(**log_extra).info(json_msg)
    elif status == AuditLogStatus.FAILURE.value:
        logger.bind(**log_extra).warning(json_msg)
    else:
        logger.bind(**log_extra).error(json_msg)

    # 2. Database audit entry persistence
    audit_entry = AuditLog(
        actor_id=actor_id,
        actor_username=actor_username,
        actor_role=actor_role,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        status=status,
        details=sanitized_details,
        error_message=error_message,
        ip_address=ip_address,
    )

    if db is not None:
        try:
            db.add(audit_entry)
            await db.commit()
            await db.refresh(audit_entry)
            return audit_entry
        except Exception as exc:
            logger.warning(
                "Failed to persist audit log using active session: {}. Retrying with fresh session.",
                exc,
            )
            try:
                await db.rollback()
            except Exception:
                pass
            if db.bind:
                try:
                    bound_factory = async_sessionmaker(
                        bind=db.bind, class_=AsyncSession, autoflush=False, expire_on_commit=False
                    )
                    async with bound_factory() as bound_fresh_db:
                        bound_fresh_db.add(audit_entry)
                        await bound_fresh_db.commit()
                        await bound_fresh_db.refresh(audit_entry)
                        return audit_entry
                except Exception as inner_exc:
                    logger.warning("Failed to persist audit log with bound session: {}", inner_exc)

    async with SessionLocal() as fresh_db:
        fresh_db.add(audit_entry)
        await fresh_db.commit()
        await fresh_db.refresh(audit_entry)
        return audit_entry
