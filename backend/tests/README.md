# Test Suite Documentation

This test suite provides automated integration and endpoint testing for all FastAPI routes in **Code Executor**, covering root health checks, code submission and queuing, and user management and authentication.

---

## 1. Architecture & Design Principles

- **Framework**: `pytest` (>= 9.0) with `pytest-asyncio` (>= 1.4).
- **Package & Dependency Manager**: `uv`.
- **HTTP Client**: `httpx.AsyncClient` with modern `httpx.ASGITransport(app=app)` (no deprecated `AsyncClient(app=app)`).
- **Database Isolation**:
  - Tests run against an isolated PostgreSQL test database (`code_buddy_test`).
  - Sessions use SQLAlchemy 2.0 async engine with `NullPool` to eliminate event-loop binding conflicts across async test runs.
  - Automatic row cleanup runs after every test in reverse foreign-key dependency order, guaranteeing test independence without expensive schema recreation.
- **Redis Isolation**:
  - The test suite interacts with Redis and automatically purges test keys (`submission:*`, `result:*`, and `code:queue`) after each test.
  - The Redis connection pool is cleanly disconnected between tests to allow subsequent tests to run within their own event loops.
- **Disk Artifact Cleanup**:
  - The `cleanup_code_storage` fixture ensures any submission directories written to `backend/code/{submission_id}` during testing are removed upon test completion.

---

## 2. Directory Structure

```text
tests/
├── conftest.py            # Fixtures (database sessions, HTTP client, Redis, cleanup)
├── test_root_routes.py    # Health check and Redis ping routes (/health, /ping-redis)
├── test_code_routes.py    # Code submission, polling, and SSE streaming (/api-v1/code/*)
├── test_user_routes.py    # Registration, login, OTP, CRUD, and username checks (/api-v1/users/*)
└── README.md              # Documentation for the testing setup
```

---

## 3. Route Coverage

### `test_root_routes.py` (4 tests)
- `GET /health`:
  - `200 OK` health status verification.
- `GET /ping-redis`:
  - `200 OK` pong confirmation when Redis is operational.
  - Failure reporting when Redis returns `False`.
  - Exception handling when Redis connection fails.

### `test_code_routes.py` (20 tests)
- `POST /api-v1/code/submit`:
  - Python submission with test cases: validates response, Redis hash creation, queue insertion, and file creation on disk.
  - Multi-language support: verifies file extension routing for `cpp` (`Main.cpp`), `c` (`Main.c`), and `java` (`Main.java`).
  - Request validation: rejects unsupported languages, empty code strings, empty test cases, and unexpected/forbidden fields with `422`.
  - Enqueue failure handling: verifies directory cleanup and `500` error response when pipeline execution fails.
- `GET /api-v1/code/submission/poll/{submission_id}`:
  - Polling existing submission metadata (`200 OK`).
  - Non-existent submission lookup (`404 Not Found`).
- `GET /api-v1/code/stream/{submission_id}`:
  - Server-Sent Events (SSE) streaming when a result exists in Redis.
  - Invalid UUID format validation (`422 Unprocessable Entity`).

### `test_user_routes.py` (39 tests)
- `POST /api-v1/users/register`:
  - Registration with password (`201 Created`).
  - Passwordless registration (`201 Created`).
  - Rejection of duplicate username (`409 Conflict`).
  - Rejection of duplicate email (`409 Conflict`).
  - Request validation constraints (`422 Unprocessable Entity`).
- `POST /api-v1/users/login`:
  - Authentication by username handle (`200 OK`).
  - Authentication by email address (`200 OK`).
  - Rejection of unverified email accounts (`403 Forbidden`).
  - Rejection of incorrect password (`401 Unauthorized`).
  - Rejection of non-existent account (`401 Unauthorized`).
  - Rejection of passwordless/OTP-only accounts attempting password login (`401 Unauthorized`).
- `POST /api-v1/users/otp/request` & `POST /api-v1/users/otp/verify`:
  - OTP generation and database dispatch (`200 OK`).
  - Rejection when requesting OTP for non-existent email (`404 Not Found`).
  - Successful OTP verification, email verified marking, and login completion (`200 OK`).
  - Rejection of mismatched OTP code (`400 Bad Request`).
  - Rejection of expired OTP code and cleanup (`400 Bad Request`).
  - Rejection when no OTP is on record (`400 Bad Request`).
  - Rejection when verifying OTP for non-existent email (`404 Not Found`).
- `GET /api-v1/users/`:
  - Pagination offset and limit checks (`200 OK`).
  - Role-based filtering (`?role=admin`, `?role=user`, `?role=moderator`).
- `GET /api-v1/users/{user_id}` & `GET /api-v1/users/username/{username}`:
  - Fetching profiles by UUID primary key (`200`, `404`, `422`).
  - Fetching profiles by unique username handle (`200`, `404`).
- `GET /api-v1/users/check-username`:
  - Availability verification via path parameter (`/check-username/{username}`).
  - Availability verification via query string (`/check-username?username=...`).
  - Case-insensitive uniqueness enforcement and format constraints.
- `PATCH /api-v1/users/{user_id}`:
  - Updating username, email, role, password, and verification status (`200 OK`).
  - Collision prevention when updated username or email is already taken (`409 Conflict`).
  - Verified login check after password update.
  - Safe no-op handling when updating user with their current username.
  - Non-existent user update (`404 Not Found`).
- `DELETE /api-v1/users/{user_id}`:
  - Deleting user and cascading removal (`200 OK`).
  - Deleting non-existent user (`404 Not Found`).

---

## 4. How to Run the Tests

Ensure the Docker dependencies (PostgreSQL and Redis) are running:
```bash
docker compose up -d
```

### Run the entire test suite
```bash
uv run pytest -v
```

### Run a specific test module
```bash
# Test root routes
uv run pytest tests/test_root_routes.py -v

# Test code submission and streaming routes
uv run pytest tests/test_code_routes.py -v

# Test user routes
uv run pytest tests/test_user_routes.py -v
```

### Run a specific test class or test function
```bash
uv run pytest tests/test_user_routes.py::TestUserRegister::test_register_user_with_password_success -v
```
