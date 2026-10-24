"""Unified development runner for Code Zero.

Starts FastAPI backend, Redis code-execution worker, and Next.js frontend simultaneously
using only Python built-in standard libraries (asyncio, os, signal, socket, subprocess).
"""

import asyncio
import os
import shutil
import signal
import socket
import sys
from pathlib import Path

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
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
WORKER_DIR = ROOT_DIR / "worker"


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
    except asyncio.CancelledError:
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
    proc: asyncio.subprocess.Process, name: str, shutdown_event: asyncio.Event
) -> None:
    """Monitors a process and triggers shutdown if it exits unexpectedly."""
    try:
        code = await proc.wait()
        if not shutdown_event.is_set():
            print(
                f"\n{YELLOW}{name} exited with code {code}. Stopping remaining services...{RESET}",
                flush=True,
            )
            shutdown_event.set()
    except asyncio.CancelledError:
        pass


async def check_prerequisites() -> None:
    """Verifies installed CLI tools and backing services concurrently."""
    if not shutil.which("uv"):
        print(
            f"{RED}{BOLD}Error:{RESET} 'uv' is not installed or not in PATH.",
            file=sys.stderr,
        )
        print(
            "Please install uv: curl -LsSf https://astral.sh/uv/install.sh | sh",
            file=sys.stderr,
        )
        sys.exit(1)

    if not shutil.which("bun"):
        print(
            f"{RED}{BOLD}Error:{RESET} 'bun' is not installed or not in PATH.",
            file=sys.stderr,
        )
        print(
            "Please install bun: curl -fsSL https://bun.sh/install | bash",
            file=sys.stderr,
        )
        sys.exit(1)

    print(f"\n{BOLD}Checking backing services (PostgreSQL & Redis)...{RESET}")
    pg_reachable, redis_reachable = await asyncio.gather(
        asyncio.to_thread(check_tcp_port, "127.0.0.1", 5432),
        asyncio.to_thread(check_tcp_port, "127.0.0.1", 6379),
    )

    has_service_errors = False
    if not pg_reachable:
        print(
            f"{RED}{BOLD}Error:{RESET} PostgreSQL is not reachable on port 5432.\n"
            f"Start it with: {BOLD}docker compose up -d postgres{RESET}\n",
            file=sys.stderr,
        )
        has_service_errors = True

    if not redis_reachable:
        print(
            f"{RED}{BOLD}Error:{RESET} Redis is not reachable on port 6379.\n"
            f"Start it with: {BOLD}docker compose up -d redis{RESET}\n",
            file=sys.stderr,
        )
        has_service_errors = True

    if has_service_errors:
        print(
            f"{RED}{BOLD}Startup aborted:{RESET} Required backing services are offline.",
            file=sys.stderr,
        )
        sys.exit(1)


async def run_subprocess_cmd(cmd: list[str], cwd: Path) -> None:
    """Runs a subprocess command and aborts startup if it fails."""
    proc = await asyncio.create_subprocess_exec(*cmd, cwd=cwd)
    code = await proc.wait()
    if code != 0:
        print(
            f"\n{RED}{BOLD}Error:{RESET} Command '{' '.join(cmd)}' failed with exit code {code}. Aborting startup.",
            file=sys.stderr,
        )
        sys.exit(code)


async def main() -> None:
    print(f"{BOLD}{BLUE}======================================================{RESET}")
    print(f"{BOLD}{BLUE}   Code Zero — Development Environment Launcher      {RESET}")
    print(f"{BOLD}{BLUE}======================================================{RESET}")

    # 1. Verify Prerequisites & Backing Services
    await check_prerequisites()

    # 2. Apply Database Migrations
    print(f"\n{BOLD}Ensuring database migrations are up to date...{RESET}")
    await run_subprocess_cmd(
        ["uv", "run", "alembic", "upgrade", "head"], cwd=BACKEND_DIR
    )

    # 3. Ensure Frontend Dependencies
    if not (FRONTEND_DIR / "node_modules").is_dir():
        print(f"\n{BOLD}Installing frontend dependencies with bun...{RESET}")
        await run_subprocess_cmd(["bun", "install"], cwd=FRONTEND_DIR)

    # Set up environment with PYTHONPATH
    env = os.environ.copy()
    env["PYTHONPATH"] = (
        f"{BACKEND_DIR}:{WORKER_DIR}:{ROOT_DIR}:{env.get('PYTHONPATH', '')}"
    )

    print(f"\n{BOLD}Starting services...{RESET}")
    print(
        f"  - {CYAN}{BOLD}[backend]{RESET}  FastAPI API Server     -> http://localhost:8000"
    )
    print(
        f"  - {CYAN}{BOLD}[docs]{RESET}     Swagger API Docs       -> http://localhost:8000/docs"
    )
    print(
        f"  - {YELLOW}{BOLD}[worker]{RESET}   Code Execution Worker  -> Listening on Redis queue"
    )
    print(
        f"  - {GREEN}{BOLD}[frontend]{RESET} Next.js Web App        -> http://localhost:3000"
    )
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
        cwd=BACKEND_DIR,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        start_new_session=True,
    )

    worker_proc = await asyncio.create_subprocess_exec(
        "uv",
        "run",
        "python",
        "worker.py",
        cwd=WORKER_DIR,
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

    shutdown_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _signal_handler(sig_name: str) -> None:
        print(
            f"\n{BOLD}{MAGENTA}Received {sig_name}, shutting down all services...{RESET}",
            flush=True,
        )
        shutdown_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler, sig.name)
        except NotImplementedError:
            pass

    # Background tasks for streaming output and process monitoring
    tasks: list[asyncio.Task] = [
        asyncio.create_task(
            stream_output(backend_proc.stdout, f"{CYAN}[backend]{RESET} ")
        ),
        asyncio.create_task(
            stream_output(worker_proc.stdout, f"{YELLOW}[worker]{RESET}  ")
        ),
        asyncio.create_task(
            stream_output(frontend_proc.stdout, f"{GREEN}[frontend]{RESET}")
        ),
    ]

    for name, proc in processes:
        tasks.append(asyncio.create_task(monitor_process(proc, name, shutdown_event)))

    try:
        await shutdown_event.wait()
    finally:
        print(f"\n{BOLD}{MAGENTA}Shutting down all services...{RESET}", flush=True)

        # Cancel streaming and monitoring tasks
        for task in tasks:
            task.cancel()

        # Terminate all child process groups with SIGTERM
        for _, proc in processes:
            kill_process_tree(proc, signal.SIGTERM)

        # Allow up to 3 seconds for graceful exit, then SIGKILL
        try:
            async with asyncio.timeout(3.0):
                for _, proc in processes:
                    if proc.returncode is None:
                        await proc.wait()
        except TimeoutError:
            pass

        for _, proc in processes:
            if proc.returncode is None:
                kill_process_tree(proc, signal.SIGKILL)

        print(f"{BOLD}{GREEN}All services stopped cleanly.{RESET}", flush=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
