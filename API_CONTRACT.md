# API Contract — Code Zero Platform

This document serves as the single source of truth for the API contract between the Code Zero frontend and the FastAPI backend (`/api-v1/*`).

---

## 1. Authentication & Authorization Mechanism

### Transport & Storage
- **Primary Auth Transport**: HTTP-only Cookies:
  - `access_token` (Short-lived JWT, default: 15 minutes)
  - `refresh_token` (Long-lived JWT, default: 7 days)
- **Secondary Auth Transport (Programmatic/Header)**:
  - Header format: `Authorization: Bearer <jwt_access_token>`
  - The frontend `lib/api.js` client sends `credentials: "include"` for cookie handling and can also attach the Bearer token in headers if cached in `localStorage` for cross-origin or non-cookie situations.
- **Roles**:
  - `user`: Standard platform user (can solve problems, view leaderboard, submit code).
  - `moderator`: Can create, edit, delete problems and templates.
  - `admin`: Full administrative access (user management, role promotion, status changes, dashboard stats, audit logs).
- **Session Expiry & 401 Handling**:
  - On HTTP `401 Unauthorized`, client attempts a token refresh via `POST /api-v1/users/refresh`. If refresh fails or is absent, the session is purged and the user is redirected to `/login`.

---

## 2. Submission Results Delivery

The backend provides two methods for delivery of code execution output and verdicts:
1. **Server-Sent Events (SSE)**:
   - Endpoint: `GET /api-v1/code/stream/{submission_id}`
   - Stream content: `event: result\ndata: { ...json payload... }\n\n`
   - Closes automatically upon verdict delivery.
2. **Polling**:
   - Endpoint: `GET /api-v1/code/submission/poll/{submission_id}`
   - Status transitions: `queued` -> `running` -> `completed` | `failed` | `tle` | `compile_error`.
   - Result payload includes: `status`, `output`, `error`, `results` (JSON array of test-case verdicts), `time_taken`, `score`, `max_score`, `tests_passed`, `total_tests`.

The frontend utilizes SSE (`EventSource`) with automatic fallback to polling if the stream disconnects or encounters network barriers.

---

## 3. Complete Backend Routes Table

| Method | Path | Auth Required | Required Role | Request Body | Response Shape | Error Responses |
|---|---|---|---|---|---|---|
| `GET` | `/health` | No | Any / Public | None | `{"status": "healthy"}` | None |
| `GET` | `/ping-redis` | No | Any / Public | None | `{"message": "Pong from Redis!"}` | `500` |
| `POST` | `/api-v1/users/register` | No | Public | `{ name?: str, username: str, email: str, password?: str }` | `UserResponse` (201 Created) | `409 Conflict`, `422 Unprocessable` |
| `POST` | `/api-v1/users/login` | No | Public | `{ username_or_email: str, password: str }` | `UserLoginResponse` (`{ message, user, auth_method }`) + Sets Cookies | `401 Unauthorized`, `403 Forbidden (Unverified/Suspended)`, `422` |
| `GET` | `/api-v1/users/me` | Yes | Active User (`user`, `moderator`, `admin`) | None | `UserResponse` | `401 Unauthorized`, `403 Forbidden` |
| `PATCH` | `/api-v1/users/me` | Yes | Active User (`user`, `moderator`, `admin`) | `UserUpdateRequest` (`{ name?: str, username?: str, password?: str, current_password?: str }`) | `UserResponse` | `400 Bad Request`, `401 Unauthorized`, `409 Conflict`, `422` |
| `POST` | `/api-v1/users/otp/request` | No | Public | `{ email: str }` | `OTPResponse` (`{ message, email, expires_in_seconds }`) | `404 Not Found`, `500` |
| `POST` | `/api-v1/users/otp/verify` | No | Public | `{ email: str, otp: str (6 digits) }` | `UserLoginResponse` (`{ message, user, auth_method }`) + Sets Cookies | `400 Bad Request`, `404 Not Found`, `422` |
| `POST` | `/api-v1/users/refresh` | Optional / Cookie | Active User | `{ refresh_token?: str }` (or cookie) | `TokenRefreshResponse` (`{ message }`) + Rotates Cookies | `401 Unauthorized`, `403 Forbidden` |
| `POST` | `/api-v1/users/logout` | No / Optional | Any | None | `MessageResponse` (`{ message }`) + Clears Cookies | None |
| `GET` | `/api-v1/users/username/{username}` | No | Public | None | `UserResponse` | `404 Not Found` |
| `GET` | `/api-v1/users/check-username/{username}` | No | Public | None | `UsernameAvailabilityResponse` (`{ username, is_available, available }`) | None |
| `GET` | `/api-v1/problems` | No | Public | Query: `skip`, `limit`, `difficulty`, `category`, `topic`, `status`, `search` | `ProblemListResponse` (`{ total, skip, limit, problems: [ProblemResponse] }`) | `422` |
| `GET` | `/api-v1/problems/{problem_id}` | No | Public | None | `ProblemResponse` | `404 Not Found` |
| `GET` | `/api-v1/problems/{problem_id}/full` | No | Public | None | `FullProblemResponse` (`{ problem, problem_code, run_test_cases, templates, test_cases_count }`) | `404 Not Found` |
| `GET` | `/api-v1/problems/{problem_id}/test-cases` | No | Public | None | `list[TestCaseResponse]` | `404 Not Found` |
| `POST` | `/api-v1/problems` | Yes | Moderator / Admin | `ProblemCreateRequest` (`title, description, difficulty, category, topic, time_limit, memory_limit, status`) | `ProblemResponse` (201 Created) | `401`, `403`, `422` |
| `POST` | `/api-v1/problems/full` | Yes | Moderator / Admin | `FullProblemCreateRequest` (`title, description, difficulty, category, topic, time_limit, memory_limit, status, run_test_cases, submit_test_cases, templates`) | `FullProblemResponse` (201 Created) | `401`, `403`, `422` |
| `PATCH` | `/api-v1/problems/{problem_id}` | Yes | Moderator / Admin | `ProblemUpdateRequest` (`title?, description?, difficulty?, category?, topic?, time_limit?, memory_limit?, status?`) | `ProblemResponse` | `401`, `403`, `404`, `422` |
| `PATCH` | `/api-v1/problems/{problem_id}/status` | Yes | Moderator / Admin | `ProblemStatusUpdateRequest` (`status: ProblemStatus`) | `ProblemResponse` | `401`, `403`, `404`, `422` |
| `DELETE` | `/api-v1/problems/{problem_id}` | Yes | Moderator / Admin | None | `MessageResponse` (`{ message }`) | `401`, `403`, `404` |
| `GET` | `/api-v1/problems/templates/common` | No | Public | None | `list[CommonProblemTemplateResponse]` | None |
| `GET` | `/api-v1/problems/templates/common/{problem_id}` | No | Public | None | `CommonProblemTemplateResponse` | `404 Not Found` |
| `POST` | `/api-v1/problems/templates/common` | Yes | Moderator / Admin | `CommonProblemTemplateCreateRequest` (`problem_id, problem_statement, time_limit, run_test_cases, submit_test_cases`) | `CommonProblemTemplateResponse` (201 Created) | `401`, `403`, `404`, `422` |
| `POST` | `/api-v1/code/run` | Optional | Any | `RunRequest` (`problem_id: int, user_code: str, language: str (c, cpp, java, python), test_cases?: list, time_limit?: float`) | `{ message, submission: UUID, status: "queued", mode: "run", streaming_url, polling_url }` | `400`, `404`, `422`, `500` |
| `POST` | `/api-v1/code/submit` | Optional | Any | `SubmitRequest` (`problem_id: int, user_code: str, language: str, time_limit?: float`) | `{ message, submission: UUID, status: "queued", mode: "submit", streaming_url, polling_url }` | `400`, `404`, `422`, `500` |
| `GET` | `/api-v1/code/stream/{submission_id}` | No | Any | None | SSE stream (`text/event-stream` with `event: result`) | `500` |
| `GET` | `/api-v1/code/submission/poll/{submission_id}` | No | Any | None | JSON Dict (`status, output, error, results, time_taken, score, max_score, tests_passed, total_tests`) | `404 Not Found` |
| `GET` | `/api-v1/leaderboard` | Optional | Any | Query: `skip`, `limit` | `LeaderboardResponse` (`{ total, skip, limit, users: [LeaderboardEntryResponse], my_rank: LeaderboardEntryResponse \| null }`) | `422` |
| `GET` | `/api-v1/leaderboard/me` | Yes | Active User | None | `LeaderboardEntryResponse` (`{ rank, user_id, username, total_score, problems_solved, submissions_count, created_at }`) | `401`, `404` |
| `GET` | `/api-v1/admin/users` | Yes | Admin | Query: `skip`, `limit`, `role`, `status`, `search` | `AdminUserListResponse` (`{ total, skip, limit, users: [AdminUserResponse] }`) | `401`, `403`, `422` |
| `GET` | `/api-v1/admin/users/{user_id}` | Yes | Admin | None | `AdminUserDetailResponse` (`...AdminUserResponse, recent_submissions: list[dict], recent_audit_actions: list[dict]`) | `401`, `403`, `404` |
| `PATCH` | `/api-v1/admin/users/{user_id}/role` | Yes | Admin | `AdminUpdateUserRoleRequest` (`role: UserRole`) | `AdminUserResponse` | `401`, `403`, `404`, `422` |
| `PATCH` | `/api-v1/admin/users/{user_id}/status` | Yes | Admin | `AdminUpdateUserStatusRequest` (`status: UserStatus`) | `AdminUserResponse` | `401`, `403`, `404`, `422` |
| `PATCH` | `/api-v1/admin/users/{user_id}` | Yes | Admin | `AdminUpdateUserRequest` (`username?, email?, password?, role?, status?, is_email_verified?, is_protected?`) | `AdminUserResponse` | `401`, `403`, `404`, `409`, `422` |
| `DELETE` | `/api-v1/admin/users/{user_id}` | Yes | Admin | None | `MessageResponse` (`{ message }`) | `401`, `403`, `404` |
| `GET` | `/api-v1/admin/stats` | Yes | Admin | Query: `days` (default 30) | `DashboardStatsResponse` (`{ users, problems, submissions, activity }`) | `401`, `403`, `422` |
| `GET` | `/api-v1/admin/stats/users` | Yes | Admin | Query: `days` | `UserStatsResponse` (`{ total_users, by_role, by_status, new_registrations_in_period, registrations_trend }`) | `401`, `403`, `422` |
| `GET` | `/api-v1/admin/stats/problems` | Yes | Admin | None | `ProblemStatsResponse` (`{ total_problems, total_including_deleted, by_difficulty, by_category, by_topic, by_status, problems_by_moderator, recently_created, recently_updated, recently_deleted }`) | `401`, `403` |
| `GET` | `/api-v1/admin/stats/submissions` | Yes | Admin | Query: `days` | `SubmissionStatsResponse` (`{ total_submissions, accepted, rejected, compilation_errors, runtime_errors, time_limit_exceeded, memory_limit_exceeded, success_rate, submissions_trend }`) | `401`, `403`, `422` |
| `GET` | `/api-v1/admin/stats/activity` | Yes | Admin | None | `SystemActivityStatsResponse` (`{ recent_admin_actions, recent_moderator_activity, user_creation_trend, problem_creation_trend }`) | `401`, `403` |
| `GET` | `/api-v1/admin/audit-logs` | Yes | Admin | Query: `skip`, `limit`, `action`, `actor_id`, `actor_role`, `target_type`, `status`, `start_date`, `end_date` | `AuditLogListResponse` (`{ total, skip, limit, logs: [AuditLogResponse] }`) | `401`, `403`, `422` |
| `GET` | `/api-v1/admin/audit-logs/{log_id}` | Yes | Admin | None | `AuditLogResponse` | `401`, `403`, `404` |

---

## 4. MISSING BACKEND ROUTES

The following features were specified in the frontend requirements but currently have no corresponding backend endpoints:

### 1. User Profile Self-Update & Change Password
- **Status**: Implemented via `PATCH /api-v1/users/me`.
- **Supported Fields**: `name`, `username`, `email`, `password`, and optional `current_password` for password verification.

### 2. User Submission History ("My Submissions")
- **Missing Endpoints**:
  - `GET /api-v1/users/me/submissions` (to list paginated historical submissions of the logged-in user with status, score, timestamp, language, code, and test case results)
  - `GET /api-v1/code/submissions/{submission_id}` (to view a specific past submission code & verdict)
- **Frontend Action**: Built on `/profile` with a full-featured submissions table component displaying recent session submissions (persisted in client storage / state for submissions run during the user session), and ready to connect to `GET /api-v1/users/me/submissions`.

### 3. Global Submissions List for Admin
- **Missing Endpoint**:
  - `GET /api-v1/admin/submissions` (listing all user submissions across the entire system with filters)
- **Note**: The backend provides aggregate metrics via `GET /api-v1/admin/stats/submissions` and 5 recent submissions per user on `GET /api-v1/admin/users/{user_id}`, but no global flat list of all submissions.
- **Frontend Action**: Built in `/admin` with submission statistics, success rate breakdowns, and user-level submission drilldowns.

### 4. Per-Problem Solved Status Flag for User
- **Missing Field / Endpoint**:
  - `GET /api-v1/problems` returns `ProblemListResponse` where each problem lacks an `is_solved` boolean for the current user.
- **Frontend Action**: The frontend tracks solved problems through the user's score/stats and session history, showing badges appropriately and ready to read `problem.is_solved` directly once the backend adds the field to `ProblemResponse`.
