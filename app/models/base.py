from datetime import UTC, datetime


def _utcnow() -> datetime:
    """Return the current time in UTC (timezone-aware).

    Use this instead of datetime.now() (naive) or datetime.utcnow() (deprecated in Python 3.12+).
    """
    return datetime.now(UTC)
