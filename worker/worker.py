import time
import json
import redis
import shutil
import pathlib
from enum import Enum

from container import DockerContainerEngine


class JobStatus(str, Enum):
    COMPLETED = "completed"
    FAILED = "failed"

client = redis.Redis(host='localhost', port=6379, decode_responses=True,socket_timeout=None)

QUEUE_NAME = "code:queue"
DOKCER_IMAGE = {
    "python": "python:3.12-alpine",
    "cpp": "gcc:12.5",
    "c": "gcc:12.5",
    "java": "java:22",
}

PATH = pathlib.Path(__file__).parent.parent.resolve()

def extract_submission_data(job: str)-> dict:
    """
    Extracts submission data from the job string.
    Args:
        job (str): The job string in JSON format.
    Returns:
        dict: A dictionary containing submission_id, test_cases, time_limit, and language."""
    job_data = json.loads(job)
    submission_id = job_data.get("submission_id")
    test_cases = job_data.get("test_cases")
    time_limit = job_data.get("time_limit")
    language = job_data.get("language")

    return {
        "submission_id": submission_id,
        "language": language,
        "test_cases": test_cases,
        "time_limit": time_limit,
    }


def compile_and_run_code(submission_data: dict) -> dict:
    """
    Compiles and runs the code in a Docker container.
    Args:
        submission_data (dict): A dictionary containing submission_id, test_cases, time_limit, and language.
    Returns:
        dict: A dictionary containing the status, output, error, and time_taken of the code execution.
    """
    submission_id = submission_data.get("submission_id")
    language = submission_data.get("language")
    test_cases = submission_data.get("test_cases")
    time_limit = submission_data.get("time_limit")

    # Initialize Docker container engine
    container = DockerContainerEngine(image_name=DOKCER_IMAGE[language], memory_limit="128m", cpu_limit="0.5", volume_mount=f"{PATH}/app/code/")
    # Start the container
    try:
        container_id = container.start_container()
    except Exception as e:
        raise RuntimeError(f"Failed to start Docker container: {e}")

    # for python and javascript, we don't need to compile the code, automatically handled by docker class
    compile_result = container.compile_code(language, folder_name=submission_id)

    if compile_result["compiled"] != True:
        # Compilation failed
        return {
            "status": JobStatus.FAILED.value,
            "output": compile_result["stdout"],
            "error": compile_result["stderr"],
            "results": "[]",
            "time_taken": 0.0
        }
    
    start_time = time.time()
    results = []
    for test_case in test_cases:
        input_data = test_case.get("input")
        expected_output = test_case.get("expected_output")

        # Execute the code inside the Docker container
        execution_result = container.execute_code(language, input_data, folder_name=submission_id)

        # Compare the output with the expected output
        if execution_result["returncode"] == 0 and execution_result["stdout"].strip() == expected_output.strip():
            results.append({"status": "passed", "output": execution_result["stdout"], "error": "", })
        else:
            results.append({"status": "failed", "output": execution_result["stdout"], "error": execution_result["stderr"]})

    end_time = time.time()
    total_time_taken = end_time - start_time
    json_results = json.dumps(results)
    
    # Stop and remove the container
    try:
        container.remove_container()
    except Exception as e:
        print(f"Error removing container: {e}")

    return {
        "status": JobStatus.COMPLETED.value,
        "output": "",
        "error": "",
        "results": json_results,
        "time_taken": total_time_taken
    }

def main():
    while True:
        # Blocking pop from the queue
        _, job = client.brpop(QUEUE_NAME, timeout=0)
        
        data = extract_submission_data(job)

        try:
            results = compile_and_run_code(data)
        except Exception as e:
            print(f"Error occurred while executing code: {e}")
            results = {"status": JobStatus.FAILED.value, "output": "", "error": str(e), "time_taken": 0}

        # Store the results back in Redis
        submission_key = f"submission:{data['submission_id']}"
        client.hset(submission_key, mapping=results)

        # remove the folder
        submission_dir = PATH / "app" / "code" / data['submission_id']
        try:
            shutil.rmtree(submission_dir)
        except FileNotFoundError:
            print("Directory already removed.")
        except Exception as e:
            print(f"Cleanup failed: {e}")

        print(f"Processed submission {data['submission_id']}. Results stored in Redis.")

            


if __name__ == "__main__":
    main()