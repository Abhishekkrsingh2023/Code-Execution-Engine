# starts the container and removes the container after execution
import subprocess
import time


LANGAUGES_TO_COMPILE = ["java", "c", "cpp"]
DOKCER_IMAGE = {
    "python": "python:3.12",
    "cpp": "gcc:12.5",
    "c": "gcc:12.5",
    "java": "java:22",
}

class DockerContainerEngine:
    """
    A class to manage Docker containers for code execution.
    This class provides methods to start a Docker container with specified resource limits and to remove the container after execution.
    """
    def __init__(self, image_name: str,volume_mount: str="shared", memory_limit: str = "128m", cpu_limit: str = "0.5"):
        """
        Initialize the DockerContainer instance.
        Args:
            image_name (str): The name of the Docker image to use for code execution (e.g., "code_executor_image").
            volume_mount (str): The volume mount path for the container (e.g.,"shared","./code").
            memory_limit (str): The memory limit for the container (e.g., "128m", "256m").
            cpu_limit (str): The CPU limit for the container (e.g., "0.5", "1").
        """
        self.image_name = image_name
        self.memory_limit = memory_limit
        self.cpu_limit = cpu_limit
        self.volume_mount = volume_mount
        self.container_id = None

    def _get_command_to_compile(self, language: str, folder_name: str) -> list:
        """
        Get the command to compile the code based on the programming language.
        Args:
            language (str): The programming language of the code snippet.
            folder_name (str): The name of the folder where the code will be executed.
            file_name (str): The name of the file containing the code.

        Returns:
            list: The command to compile the code.
        """
        if language == "java":
            return ["docker", "exec", "-i", f"{self.container_id}", "javac", f"/shared/{folder_name}/Main.java"]
        elif language == "cpp":
            return ["docker", "exec", "-i", f"{self.container_id}", "g++", f"/shared/{folder_name}/Main.cpp", "-o", f"/shared/{folder_name}/a.out"]
        elif language == "c":
            return ["docker", "exec", "-i", f"{self.container_id}", "gcc", f"/shared/{folder_name}/Main.c", "-o", f"/shared/{folder_name}/a.out"]
        else:
            raise ValueError(f"Unsupported language for compilation: {language}")
        
    def _get_command_to_execute(self, language: str, folder_name: str) -> list:
        """
        Get the command to execute the code based on the programming language.
        Args:
            language (str): The programming language of the code snippet.
            folder_name (str): The name of the folder where the code will be executed.
            file_name (str): The name of the file containing the code.

        Returns:
            list: The command to execute the code.
        """
        if language == "java":
            return ["docker", "exec", "-i", f"{self.container_id}", "java", "-cp", f"/shared/{folder_name}", 'Main']
        elif language in ["c", "cpp"]:
            return ["docker", "exec", "-i", f"{self.container_id}", f"/shared/{folder_name}/a.out"]
        elif language == "python":
            return ["docker", "exec", "-i", f"{self.container_id}", "python", f"/shared/{folder_name}/Main.py"]
        else:
            raise ValueError(f"Unsupported language for execution: {language}")
        
    def start_container(self) -> str:
        """
        Start a Docker container to execute the code.
        Returns:
            str: The ID of the started container.
        """
        try:
            command = [
                "docker",
                "run",
                "-d",
                "--network", "none",
                "--memory", self.memory_limit,
                "--cpus", self.cpu_limit,
            ]

            if self.volume_mount:
                command.extend([
                    "-v",
                    f"{self.volume_mount}:/shared"
                ])
            command.extend([
                self.image_name,
                "sleep",
                "infinity"
            ])

            self.container_id = subprocess.check_output(command, text=True).strip()
            return self.container_id
        
        except Exception as e:
            raise RuntimeError(f"Failed to start Docker container: {e}")

        
    def _return_format(self, stdout: str, stderr: str, returncode: int, compiled: bool | None=None) -> dict:
        if compiled is not None:
            return {
                "stdout": stdout,
                "stderr": stderr,
                "returncode": returncode,
                "compiled": compiled
            }
        return {
            "stdout": stdout,
            "stderr": stderr,
            "returncode": returncode
        }

    def remove_container(self) -> None:
        """
        Remove the Docker container.
        """
        if self.container_id:
            try:
                result = subprocess.run(["docker", "rm", "-f", self.container_id], capture_output=True, text=True)
                return result
            except Exception as e:
                print(f"Error removing container: {e}")

    def compile_code(self, language: str, folder_name: str) -> dict:
        """
        Compile the given code inside the Docker container.
        """
        if language not in LANGAUGES_TO_COMPILE:
            return self._return_format("", f"Compilation not required for language: {language}", 0, compiled=True)
        
        compilation_command = self._get_command_to_compile(language, folder_name)

        try:
            result = subprocess.run(
                compilation_command,
                text=True,
                capture_output=True
            )
            return self._return_format(result.stdout, result.stderr, result.returncode, compiled=result.returncode == 0)
        
        except Exception as e:
            print(e)
            return self._return_format("", str(e), -1, compiled=False)
        

    def execute_code(self, language: str, input_data: str,folder_name: str) -> str:
        """
        Execute the given code inside the Docker container.

        Args:
            code (str): The code snippet to execute.
            language (str): The programming language of the code snippet.
            input_data (str): The input data for the code execution.
            folder_name (str): The name of the folder where the code will be executed.
            file_name (str): The name of the file containing the code.

        Returns:
            str: The output from the code execution.
        """
        EXECUTION_COMMANDS = self._get_command_to_execute(language, folder_name)

        try:
            result = subprocess.run(
                EXECUTION_COMMANDS,
                input=input_data,
                text=True,
                capture_output=True
            )

            return self._return_format(result.stdout, result.stderr, result.returncode)
        
        except Exception as e:
            print(e)
            return self._return_format("", str(e), -1)


if __name__ == "__main__":
    # Example usage
    container = DockerContainerEngine(image_name="gcc:12.5", memory_limit="128m", cpu_limit="0.5", volume_mount="./code-sample")
    try:
        container_id = container.start_container()
        print(f"Started container with ID: {container_id}")
    except RuntimeError as e:
        print(e)
    time.sleep(2)  # Wait for the container to start
    print(container.remove_container())