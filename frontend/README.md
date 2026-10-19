# Code Zero — Frontend

Modern, minimalistic, and high-performance frontend for the **Code Zero** code execution and competitive programming engine. Built with **Next.js (App Router)**, **JavaScript**, **Tailwind CSS**, **Axios**, and **Monaco Editor**, using **Bun**.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Bun](https://bun.sh/) (v1.0+) installed on your machine:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

### 2. Environment Configuration
Create or edit `.env.local` inside the `frontend/` directory:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Installation
Install all dependencies using Bun:
```bash
bun install
```

### 4. Running the Development Server
```bash
bun dev
```
The application will be live at [http://localhost:3000](http://localhost:3000).

### 5. Production Build
To create an optimized production build:
```bash
bun run build
bun start
```

---

## 🔒 CORS Configuration Notes (FastAPI)

If you encounter Cross-Origin Resource Sharing (CORS) errors in the browser when making requests to the FastAPI backend, check `app/main.py` in the backend codebase.

### What is currently configured in `app/main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Exactly what to change if CORS blocks your requests:

1. **If your frontend is running on a different port (e.g., `3001`) or domain:**
   Open `app/main.py` and add your exact frontend origin to `allow_origins`:
   ```python
   allow_origins=[
       "http://localhost:3000",
       "http://localhost:3001",   # <-- Add your custom port
       "https://your-custom-domain.com",  # <-- Add production domain
   ],
   ```

2. **Crucial rule for `allow_credentials=True`:**
   Because authentication utilizes HTTP-only cookies (`access_token`, `refresh_token`), FastAPI **forbids** using wildcard `allow_origins=["*"]` when `allow_credentials=True`. You must specify the explicit origins or use `allow_origin_regex`.

3. **Allowing any localhost/LAN port dynamically:**
   The regex already present in `app/main.py` covers any localhost port:
   ```python
   allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
   ```
   If accessing across a local area network (e.g., `http://192.168.1.50:3000`), update the regex to:
   ```python
   allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.[0-9]+\.[0-9]+)(:[0-9]+)?$"
   ```

---

## 📂 Architecture & Design Patterns

- **Single Constant for App Name**: The platform name lives strictly in `lib/config.js` (`APP_NAME = "Code Zero"`). Changing this single variable renames the platform everywhere across the UI.
- **Client Fetch Helper**: `lib/api.js` encapsulates an Axios instance configured with `withCredentials: true`, automatic Authorization header fallback, and response interceptors handling transparent token refresh on `401 Unauthorized`.
- **Authentication State**: Managed via `lib/AuthContext.js` with optimistic localStorage hydration and background `/api-v1/users/me` session validation.
- **Route Protection**: `components/AuthGuard.js` validates authentication and role permissions client-side without relying on hidden links alone.
- **Code Editor**: Integrated with **Monaco Editor** (`@monaco-editor/react`), supporting Python, C++, C, and Java syntax highlighting, line numbers, automatic layout, and boilerplate templates.
- **Live Execution Feedback**: Uses Server-Sent Events (`/api-v1/code/stream/{submission_id}`) with automatic polling fallback (`/api-v1/code/submission/poll/{submission_id}`) to deliver sub-second judge verdicts and per-test-case results.
