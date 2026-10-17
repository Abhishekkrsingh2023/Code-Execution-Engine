"""Worker process logging configuration using Loguru.

Configures file-based rotating logging for the background code execution worker:
- Primary file sink: worker/logs/worker.log (rotated at 10 MB, 30 days retention, thread-safe enqueue)
- Console sink: stderr stream for container / runtime visibility
- Idempotent configuration to prevent duplicate log sinks on re-imports.
"""

from __future__ import annotations

from pathlib import Path

from loguru import logger

LOGS_DIR: Path = Path(__file__).parent.resolve()
DEFAULT_LOG_FILE: Path = LOGS_DIR / "worker.log"
DEFAULT_ROTATION: str = "10 MB"
DEFAULT_RETENTION: str = "30 days"
DEFAULT_LEVEL: str = "INFO"
LOG_FORMAT: str = (
    "{time:YYYY-MM-DD HH:mm:ss.SSS} | {level:<8} | {name}:{function}:{line} - {message}"
)

_worker_sink_id: int | None = None


def setup_logging(
    log_file: Path | str = DEFAULT_LOG_FILE,
    rotation: str = DEFAULT_ROTATION,
    retention: str = DEFAULT_RETENTION,
    level: str = DEFAULT_LEVEL,
) -> int:
    """Configures file-based rotating logger for the worker using Loguru.

    Args:
        log_file: Destination path for the worker log file.
        rotation: Size or time threshold for rotating log files (e.g., '10 MB', '1 day').
        retention: Duration or count threshold to retain rotated archives (e.g., '30 days', 5).
        level: Minimum logging level ('DEBUG', 'INFO', 'WARNING', 'ERROR').

    Returns:
        The Loguru sink identifier for the file sink.
    """
    global _worker_sink_id

    file_path = Path(log_file)
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Prevent duplicate file sinks if setup_logging is called multiple times
    if _worker_sink_id is not None:
        try:
            logger.remove(_worker_sink_id)
        except ValueError:
            pass
        _worker_sink_id = None

    sink_id = logger.add(
        str(file_path),
        rotation=rotation,
        retention=retention,
        level=level,
        format=LOG_FORMAT,
        encoding="utf-8",
        enqueue=True,  # Asynchronous thread-safe non-blocking I/O
    )
    _worker_sink_id = sink_id
    return sink_id


__all__ = ["DEFAULT_LOG_FILE", "logger", "setup_logging"]
