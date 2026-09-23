# Manages Docker containers for sandboxed code execution.
import subprocess

LANGUAGES_TO_COMPILE = ["java", "c", "cpp"]


class DockerContainerEngine:
    """
    Manages a single Docker container for sandboxed code execution.

    Security controls applied to every container:
    - ``--network none``       No internet access.
    - ``--memory``             Caps RAM to prevent OOM attacks.
    - ``--cpus``               Caps CPU time.
    - ``--pids-limit``         Caps process count — prevents fork bombs.
    - ``--security-opt no-new-privileges``  Blocks privilege escalation via setuid.
    - Volume mount scoped to the specific submission directory only —
      a container cannot read another user's source files.
    """

    def __init__(
        self,
        image_name: str,
        volume_mount: str = "shared",
        memory_limit: str = "128m",
        cpu_limit: str = "0.5",
        pids_limit: int = 50,
    ):
        """
        Args:
            image_name:   Docker image to use (e.g. ``python:3.12-alpine``).
            volume_mount: Host-side base directory for code (e.g. ``/opt/app/code``).
                          The specific submission subfolder is appended in
                          :meth:`start_container`, so only that folder is mounted.
            memory_limit: Memory cap (e.g. ``"128m"``).
            cpu_limit:    CPU cap (e.g. ``"0.5"``).
            pids_limit:   Maximum number of processes/threads inside the container.
                          50 is enough for any normal program; prevents fork bombs.
        """
        self.image_name = image_name
        self.memory_limit = memory_limit
        self.cpu_limit = cpu_limit
        self.pids_limit = pids_limit
        self.volume_mount = volume_mount
        self.container_id: str | None = None

    # ── Private helpers ──────────────────────────────────────────────────────

    def _get_command_to_compile(self, language: str, folder_name: str) -> list[str]:
        """Return the ``docker exec`` argv list to compile the code."""
        if language == "java":
            return ["docker", "exec", "-i", self.container_id, "javac", f"/shared/{folder_name}/Main.java"]
        elif language == "cpp":
            return [
                "docker", "exec", "-i", self.container_id,
                "g++", f"/shared/{folder_name}/Main.cpp", "-o", f"/shared/{folder_name}/a.out",
            ]
        elif language == "c":
            return [
                "docker", "exec", "-i", self.container_id,
                "gcc", f"/shared/{folder_name}/Main.c", "-o", f"/shared/{folder_name}/a.out",
            ]
        else:
            raise ValueError(f"Unsupported language for compilation: {language}")

    def _get_command_to_execute(self, language: str, folder_name: str) -> list[str]:
        """Return the ``docker exec`` argv list to run the compiled/interpreted code."""
        if language == "java":
            return ["docker", "exec", "-i", self.container_id, "java", "-cp", f"/shared/{folder_name}", "Main"]
        elif language in ["c", "cpp"]:
            return ["docker", "exec", "-i", self.container_id, f"/shared/{folder_name}/a.out"]
        elif language == "python":
            return ["docker", "exec", "-i", self.container_id, "python", f"/shared/{folder_name}/Main.py"]
        else:
            raise ValueError(f"Unsupported language for execution: {language}")

    def _return_format(
        self,
        stdout: str,
        stderr: str,
        returncode: int,
        compiled: bool | None = None,
    ) -> dict:
        base = {"stdout": stdout, "stderr": stderr, "returncode": returncode}
        if compiled is not None:
            base["compiled"] = compiled
        return base

    # ── Public interface ─────────────────────────────────────────────────────

    def start_container(self, folder_name: str) -> str:
        """
        Start a long-running ``sleep infinity`` container with the submission's
        source directory mounted read-write at ``/shared/<folder_name>``.

        Only the specific submission subfolder is mounted — containers cannot
        access each other's source files.

        Args:
            folder_name: The submission ID; used to scope the volume mount.

        Returns:
            The full container ID string.
        """
        try:
            command = [
                "docker", "run", "-d",
                "--network",      "none",
                "--memory",       self.memory_limit,
                "--cpus",         self.cpu_limit,
                # Security: cap process count to defeat fork bombs
                "--pids-limit",   str(self.pids_limit),
                # Security: block setuid / capability escalation
                "--security-opt", "no-new-privileges",
            ]

            if self.volume_mount and folder_name:
                # Mount ONLY this submission's subdirectory, not the entire
                # shared code root, so containers are isolated from each other.
                host_path = f"{self.volume_mount}/{folder_name}"
                container_path = f"/shared/{folder_name}"
                command.extend(["-v", f"{host_path}:{container_path}"])

            command.extend([self.image_name, "sleep", "infinity"])

            self.container_id = subprocess.check_output(command, text=True).strip()
            return self.container_id

        except Exception as e:
            raise RuntimeError(f"Failed to start Docker container: {e}")

    def remove_container(self) -> None:
        """Force-remove the container. Safe to call even if already removed."""
        if self.container_id:
            try:
                subprocess.run(
                    ["docker", "rm", "-f", self.container_id],
                    capture_output=True,
                    text=True,
                )
            except Exception as e:
                print(f"Error removing container {self.container_id}: {e}")

    def compile_code(self, language: str, folder_name: str) -> dict:
        """
        Compile the source file inside the container.

        For interpreted languages (Python) this is a no-op and returns
        ``compiled=True`` immediately.
        """
        if language not in LANGUAGES_TO_COMPILE:
            return self._return_format(
                "", f"Compilation not required for language: {language}", 0, compiled=True
            )

        compilation_command = self._get_command_to_compile(language, folder_name)
        try:
            result = subprocess.run(
                compilation_command,
                text=True,
                capture_output=True,
            )
            return self._return_format(
                result.stdout, result.stderr, result.returncode,
                compiled=(result.returncode == 0),
            )
        except Exception as e:
            print(e)
            return self._return_format("", str(e), -1, compiled=False)

    def execute_code(self, language: str, input_data: str, folder_name: str, timeout: float = 5.0) -> dict:
        """
        Execute the code inside the container against a single test-case input.

        Args:
            language:   Programming language identifier.
            input_data: stdin to feed the process.
            folder_name: Submission ID / directory name.
            timeout:    Wall-clock seconds before the run is killed and a
                        ``TLE`` (Time Limit Exceeded) result is returned.
                        This is the only mechanism that prevents infinite loops
                        from hanging the worker forever.

        Returns:
            dict with ``stdout``, ``stderr``, and ``returncode``.
            On TLE, ``returncode`` is 124 (matching the ``timeout(1)`` convention).
        """
        execution_command = self._get_command_to_execute(language, folder_name)
        try:
            result = subprocess.run(
                execution_command,
                input=input_data,
                text=True,
                capture_output=True,
                timeout=timeout,  # ← Critical: kills infinite-loop submissions
            )
            return self._return_format(result.stdout, result.stderr, result.returncode)

        except subprocess.TimeoutExpired:
            # returncode 124 matches the POSIX timeout(1) command convention
            return self._return_format("", "Time Limit Exceeded", 124)

        except Exception as e:
            print(e)
            return self._return_format("", str(e), -1)