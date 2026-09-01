# ⚡ Code-Execution-Engine

A scalable, asynchronous remote code execution engine built with **FastAPI**, **Redis**, and **Docker**. Designed for competitive programming platforms and online judges (like LeetCode, Codeforces, or HackerRank), it safely compiles and executes untrusted code in isolated, resource-constrained container sandboxes across multiple programming languages.

---

## 🌟 Highlights

- **Reusable Docker Container Engine**: Features a custom-built, modular class (`DockerContainerEngine`) created specifically to handle secure container lifecycle, compilation, sandboxed execution, resource quotas, and cleanup.
- **Asynchronous Task Queue**: Uses Redis queues (`BRPOP`/`LPUSH`) to decouple HTTP ingestion from heavy code execution workloads.
- **Multi-Language Support**: Compiles and runs **C**, **C++**, **Java**, and **Python**.
- **Security Sandboxing**: Containers run with **zero network access** (`--network none`) and strict memory (`--memory`) and CPU (`--cpus`) limits.
- **Dynamic Template Stitching**: Leverages **Jinja2** to wrap user solutions into driver code harnesses (`main_code` + `user_code`).
- **Comprehensive Problem Management**: Includes relational database models (PostgreSQL via SQLAlchemy & Alembic) to store problem statements, test cases, and language-specific templates.

---

## 🚀 The Reusable `DockerContainerEngine` Class

A central contribution of this project is the **`DockerContainerEngine`** class located in [`worker/container.py`](worker/container.py). It abstracts away low-level Docker CLI interactions into an intuitive, reusable Python interface for compiling and executing code inside isolated containers.

### Key Capabilities:
1. **Host & Container Isolation**:
   - Automatically attaches `--network none` to prevent untrusted code from making external network calls.
   - Enforces configurable resource constraints (default: `128m` RAM, `0.5` CPU cores) to prevent Denial of Service (DoS) attacks, infinite loops, and memory exhaustion.
2. **Lifecycle Management**:
   - Starts containers in the background (`sleep infinity`), attaches host directories via volume mounts (`-v <mount>:/shared`), and provides graceful force-cleanup (`docker rm -f`).
3. **Smart Compilation & Execution**:
   - Distinguishes compiled languages (`c`, `cpp`, `java`) from interpreted languages (`python`).
   - Automatically selects appropriate compiler toolchains (`gcc`, `g++`, `javac`) and runtime commands.
   - Captures standard output (`stdout`), standard error (`stderr`), and exit codes (`returncode`).

### Reusable Example Usage

You can easily import and reuse `DockerContainerEngine` in any external script or project:

```python
from worker.container import DockerContainerEngine

# 1. Initialize the container engine with custom resource limits and volume mount
container = DockerContainerEngine(
    image_name="gcc:12.5",
    memory_limit="128m",
    cpu_limit="0.5",
    volume_mount="/path/to/code_directory"
)

try:
    # 2. Spin up the sandboxed container
    container_id = container.start_container()
    print(f"Container started: {container_id}")

    # 3. Compile source code (e.g. C / C++ / Java)
    compile_result = container.compile_code(language="cpp", folder_name="submission_123")
    if not compile_result["compiled"]:
        print(f"Compilation Error: {compile_result['stderr']}")
    else:
        # 4. Execute the binary with standard input data
        exec_result = container.execute_code(
            language="cpp",
            input_data="42\n",
            folder_name="submission_123"
        )
        print(f"Output: {exec_result['stdout']}")
        print(f"Exit Code: {exec_result['returncode']}")

finally:
    # 5. Clean up and remove the container
    container.remove_container()
```

---

## 🏗️ Architecture & Workflow

```
[ Client ] 
    │
    │ 1. POST /api-v1/code/submit (user_code, main_code, test_cases)
    ▼
[ FastAPI Server ] ──► Stores metadata in Redis Hash (`submission:<id>`)
    │              ──► Prepares workspace directory (`app/code/<id>/`)
    │              ──► Pushes job into Redis Queue (`code:queue`)
    │
    ▼
[ Redis Queue ] (Broker)
    │
    │ 2. Worker fetches job via BRPOP
    ▼
[ Worker Service ]
    │
    ├──► 3. Instantiates `DockerContainerEngine`
    ├──► 4. Starts sandboxed container (--network none, memory/cpu limits)
    ├──► 5. Compiles code (if C/C++/Java)
    ├──► 6. Evaluates test cases sequentially with stdin/stdout
    ├──► 7. Computes results & execution time
    ├──► 8. Writes verdict back to Redis (`submission:<id>`)
    └──► 9. Teardown container & cleans up host files
    ▲
    │ 10. GET /api-v1/code/submission/poll/{id}
[ Client ]
```

---

## 📁 Project Structure

```text
code-executor/
├── app/
│   ├── code/                      # Ephemeral directory for code execution jobs
│   ├── config.py                  # Global settings (Redis, Database URLs, connection pools)
│   ├── database.py                # Async SQLAlchemy engine and session setup
│   ├── main.py                    # FastAPI application entrypoint and health routes
│   ├── models.py                  # SQLAlchemy models (CommonProblemTemplate, ProblemTemplate)
│   ├── redis_client.py            # Async Redis connection pool setup
│   ├── routers/
│   │   ├── code_routes.py         # Endpoints for code submission and status polling
│   │   └── problem_setter.py      # CRUD endpoints for problems and templates
│   └── schemas/
│       ├── problem.py             # Pydantic schemas for problem templates
│       └── submission.py          # Pydantic schemas for submissions & test cases
├── worker/
│   ├── container.py               # Reusable DockerContainerEngine class
│   └── worker.py                  # Redis worker process consuming code:queue
├── alembic/                       # Database migrations
├── alembic.ini                    # Alembic configuration
├── docker-compose.yml             # Local Redis service definition
├── automate.py                    # Script to automate problem creation & templates
├── create-folder.py               # Helper utility to scaffold problem directories
├── pyproject.toml                 # Project metadata & Python dependencies (uv / pip)
└── README.md
```

---

## 🛠️ Supported Languages & Docker Environments

| Language | Docker Image | Compilation Command | Execution Command |
| :--- | :--- | :--- | :--- |
| **Python** | `python:3.12-alpine` | *Interpreted (None)* | `python /shared/{id}/Main.py` |
| **C** | `gcc:12.5` | `gcc /shared/{id}/Main.c -o /shared/{id}/a.out` | `/shared/{id}/a.out` |
| **C++** | `gcc:12.5` | `g++ /shared/{id}/Main.cpp -o /shared/{id}/a.out` | `/shared/{id}/a.out` |
| **Java** | `java:22` | `javac /shared/{id}/Main.java` | `java -cp /shared/{id} Main` |

---

## ⚙️ Getting Started

### 1. Prerequisites

- **Python**: `>= 3.13` (managed via [`uv`](https://github.com/astral-sh/uv) or `pip`)
- **Docker**: Installed and running daemon
- **PostgreSQL**: Running instance (default: `localhost:5432`)
- **Redis**: Running instance (default: `localhost:6379`)

### 2. Pull Docker Images

Pre-pull the runtime Docker images used by the worker:

```bash
docker pull python:3.12-alpine
docker pull gcc:12.5
docker pull java:22
```

### 3. Spin Up Infrastructure

Start the Redis instance using Docker Compose:

```bash
docker compose up -d
```

### 4. Install Dependencies

Using `uv`:
```bash
uv sync
```
Or using standard `pip`:
```bash
pip install -e .
```

### 5. Run Database Migrations

Apply Alembic migrations to set up the PostgreSQL schema:

```bash
uv run alembic upgrade head
```

---

## 🏃 Running the Application

### 1. Start the FastAPI API Server

```bash
uv run fastapi dev app/main.py --port 8000
```
Interactive Swagger documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Start the Background Worker

In a separate terminal, launch the worker listening to the Redis queue:

```bash
uv run python worker/worker.py
```

---

## 📡 API Reference

### 1. Submit Code for Execution

- **Endpoint**: `POST /api-v1/code/submit`
- **Request Body**:
```json
{
  "submission_id": "sub_101",
  "language": "python",
  "main_code": "import sys\n\n{{ user_code }}\n\ndef main():\n    data = sys.stdin.read().strip()\n    print(Solution().reverse(data))\n\nif __name__ == '__main__':\n    main()",
  "user_code": "class Solution:\n    def reverse(self, s: str) -> str:\n        return s[::-1]",
  "test_cases": [
    {
      "input": "hello",
      "expected_output": "olleh"
    },
    {
      "input": "world",
      "expected_output": "dlrow"
    }
  ],
  "time_limit": 2.0
}
```

- **Response (`200 OK`)**:
```json
{
  "message": "Submission received successfully.",
  "submission": {
    "submission_id": "sub_101",
    "language": "python",
    "time_limit": 2.0
  }
}
```

### 2. Poll Submission Result

- **Endpoint**: `GET /api-v1/code/submission/poll/{submission_id}`
- **Response (`200 OK`)**:
```json
{
  "submission_id": "sub_101",
  "status": "completed",
  "time_taken": "0.1423",
  "error": "",
  "output": "",
  "results": "[{\"status\": \"passed\", \"output\": \"olleh\", \"error\": \"\"}, {\"status\": \"passed\", \"output\": \"dlrow\", \"error\": \"\"}]"
}
```

### 3. Problem Template Management

- `POST /problem-templates/`: Create problem statement and default test cases.
- `GET /problem-templates/`: List all problem templates.
- `GET /problem-templates/{problem_id}`: Fetch problem statement with all language templates.
- `POST /problem-templates/{problem_id}/languages/{language}`: Add or update language-specific source templates.

---

## 🔒 Security & Sandboxing Features

Running untrusted user-submitted code requires rigorous sandboxing:
- **No Network Egress**: Docker flag `--network none` guarantees that malicious code cannot initiate outbound network requests, port scans, or participate in botnets.
- **Resource Constraints**: Strict limits on RAM (`--memory 128m`) and CPU cores (`--cpus 0.5`) defend the host machine from fork-bombs and memory leak exploits.
- **Isolated Ephemeral Volumes**: Every submission runs in an isolated directory (`app/code/<submission_id>`), which is cleaned up immediately after evaluation.
- **Ephemeral Container Lifetime**: Each execution creates a dedicated container that is forcefully terminated and deleted (`docker rm -f`) post-run.

---

## 👤 Author

Developed by **Abhishek** ([@Abhishekkrsingh2023](https://github.com/Abhishekkrsingh2023)).
- Designed and engineered the architecture, asynchronous pipeline, and the reusable **`DockerContainerEngine`** for sandboxed execution.
