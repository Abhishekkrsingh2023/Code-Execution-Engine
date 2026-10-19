#!/usr/bin/env python3
"""Unified development runner for Code Zero.

Starts FastAPI backend, Redis code-execution worker, and Next.js frontend simultaneously
using `asyncer` for structured concurrency, type-safe background task spawning, and clean teardown.
"""

import asyncio
import os
import shutil
import signal
import socket
import sys
from pathlib import Path

import anyio
import asyncer

# ANSI Color Codes
CYAN = "\033[0;36m"
GREEN = "\033[0;32m"
YELLOW = "\033[0;33m"
RED = "\033[0;31m"
MAGENTA = "\033[0;35m"
BLUE = "\033[0;34m"
BOLD = "\033[1m"
RESET = "\033[0m"

ROOT_DIR = Path(__file__).parent.resolve()
FRONTEND_DIR = ROOT_DIR / "frontend"


def check_tcp_port(host: str, port: int, timeout: float = 1.0) -> bool:
    """Synchronously tests if a TCP port is open."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


async def stream_output(stream: asyncio.StreamReader | None, prefix: str) -> None:
    """Reads a process output stream line-by-line and prints it with a colored prefix."""
    if stream is None:
        return
    try:
        while True:
            line = await stream.readline()
            if not line:
                break
            decoded = line.decode("utf-8", errors="replace").rstrip("\r\n")
            print(f"{prefix} {decoded}", flush=True)
    except (asyncio.CancelledError, anyio.get_cancelled_exc_class()):
        pass


def kill_process_tree(proc: asyncio.subprocess.Process, sig: signal.Signals) -> None:
    """Terminates the process and all of its spawned children via process group."""
    if proc.returncode is not None:
        return
    try:
        pgid = os.getpgid(proc.pid)
        os.killpg(pgid, sig)
    except (ProcessLookupError, PermissionError):
        try:
            proc.send_signal(sig)
        except ProcessLookupError:
            pass


async def monitor_process(
    proc: asyncio.subprocess.Process, name: str, tg: asyncer.TaskGroup
) -> None:
    """Monitors a process and triggers task-group cancellation if it exits unexpectedly."""
    try:
        code = await proc.wait()
        if tg.cancel_scope.cancel_called:
            return
        print(
            f"\n{YELLOW}{name} exited with code {code}. Stopping remaining services...{RESET}",
            flush=True,
        )
        tg.cancel_scope.cancel()
    except (asyncio.CancelledError, anyio.get_cancelled_exc_class()):
        pass


async def signal_watcher(tg: asyncer.TaskGroup) -> None:
    """Catches OS interrupt signals and requests structured task-group cancellation."""
    try:
        with anyio.open_signal_receiver(signal.SIGINT, signal.SIGTERM) as signals:
            async for sig in signals:
                print(
                    f"\n{BOLD}{MAGENTA}Received {sig.name}, shutting down all services...{RESET}",
                    flush=True,
                )
                tg.cancel_scope.cancel()
                return
    except (asyncio.CancelledError, anyio.get_cancelled_exc_class()):
        pass


async def check_prerequisites() -> None:
    """Verifies installed CLI tools and backing services concurrently."""
    if not shutil.which("uv"):
        print(f"{RED}{BOLD}Error:{RESET} 'uv' is not installed or not in PATH.", file=sys.stderr)
        print("Please install uv: curl -LsSf https://astral.sh/uv/install.sh | sh", file=sys.stderr)
        sys.exit(1)

    if not shutil.which("bun"):
        print(f"{RED}{BOLD}Error:{RESET} 'bun' is not installed or not in PATH.", file=sys.stderr)
        print("Please install bun: curl -fsSL https://bun.sh/install | bash", file=sys.stderr)
        sys.exit(1)

    print(f"\n{BOLD}Checking backing services (PostgreSQL & Redis)...{RESET}")
    async with asyncer.create_task_group() as tg:
        pg_task = tg.soonify(asyncer.asyncify(check_tcp_port))("127.0.0.1", 5432)
        redis_task = tg.soonify(asyncer.asyncify(check_tcp_port))("127.0.0.1", 6379)

    if not pg_task.value:
        print(
            f"{YELLOW}Warning: PostgreSQL does not appear to be reachable on port 5432.{RESET}\n"
            f"You can start it with: {BOLD}docker compose up -d postgres{RESET}"
        )
    if not redis_task.value:
        print(
            f"{YELLOW}Warning: Redis does not appear to be reachable on port 6379.{RESET}\n"
            f"You can start it with: {BOLD}docker compose up -d redis{RESET}"
        )


async def main() -> None:
    print(f"{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}   Code Zero — Development Environment Launcher      {RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    # 1. Verify Prerequisites & Backing Services
    await check_prerequisites()

    # 2. Apply Database Migrations
    print(f"\n{BOLD}Ensuring database migrations are up to date...{RESET}")
    await anyio.run_process(["uv", "run", "alembic", "upgrade", "head"], cwd=ROOT_DIR)

    # 3. Ensure Frontend Dependencies
    if not (FRONTEND_DIR / "node_modules").is_dir():
        print(f"\n{BOLD}Installing frontend dependencies with bun...{RESET}")
        await anyio.run_process(["bun", "install"], cwd=FRONTEND_DIR)

    # Set up environment with PYTHONPATH
    env = os.environ.copy()
    env["PYTHONPATH"] = f"{ROOT_DIR}:{env.get('PYTHONPATH', '')}"

    print(f"\n{BOLD}Starting services...{RESET}")
    print(f"  - {CYAN}{BOLD}[backend]{RESET}  FastAPI API Server     -> http://localhost:8000")
    print(f"  - {CYAN}{BOLD}[docs]{RESET}     Swagger API Docs       -> http://localhost:8000/docs")
    print(f"  - {YELLOW}{BOLD}[worker]{RESET}   Code Execution Worker  -> Listening on Redis queue")
    print(f"  - {GREEN}{BOLD}[frontend]{RESET} Next.js Web App        -> http://localhost:3000")
    print(f"\n{BOLD}Press [Ctrl+C] to stop all services simultaneously.{RESET}\n")

    # Start child processes in new process groups for clean process tree termination
    backend_proc = await asyncio.create_subprocess_exec(
        "uv",
        "run",
        "fastapi",
        "dev",
        "app/main.py",
        "--port",
        "8000",
        cwd=ROOT_DIR,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        start_new_session=True,
    )

    worker_proc = await asyncio.create_subprocess_exec(
        "uv",
        "run",
        "python",
        "worker/worker.py",
        cwd=ROOT_DIR,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        start_new_session=True,
    )

    frontend_proc = await asyncio.create_subprocess_exec(
        "bun",
        "dev",
        cwd=FRONTEND_DIR,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        start_new_session=True,
    )

    processes = [
        ("FastAPI Backend", backend_proc),
        ("Execution Worker", worker_proc),
        ("Next.js Frontend", frontend_proc),
    ]

    try:
        # Structured concurrency using asyncer TaskGroup
        async with asyncer.create_task_group() as tg:
            # 1. Output streams
            tg.soonify(stream_output)(backend_proc.stdout, f"{CYAN}[backend]{RESET} ")
            tg.soonify(stream_output)(worker_proc.stdout, f"{YELLOW}[worker]{RESET}  ")
            tg.soonify(stream_output)(frontend_proc.stdout, f"{GREEN}[frontend]{RESET}")

            # 2. Process exit monitors
            for name, proc in processes:
                tg.soonify(monitor_process)(proc, name, tg)

            # 3. OS Signal listener (SIGINT, SIGTERM)
            tg.soonify(signal_watcher)(tg)
    finally:
        print(f"\n{BOLD}{MAGENTA}Shutting down all services...{RESET}", flush=True)

        # Terminate all child process groups
        for _, proc in processes:
            kill_process_tree(proc, signal.SIGTERM)

        # Allow up to 3 seconds for graceful exit, then force kill
        with anyio.move_on_after(3.0):
            for _, proc in processes:
                if proc.returncode is None:
                    await proc.wait()

        for _, proc in processes:
            if proc.returncode is None:
                kill_process_tree(proc, signal.SIGKILL)

        print(f"{BOLD}{GREEN}All services stopped cleanly.{RESET}", flush=True)


if __name__ == "__main__":
    try:
        asyncer.runnify(main)()
    except KeyboardInterrupt:
        pass
