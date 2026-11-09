# Code0 Web Client

The official user-facing web application for **Code0**, an online code execution and algorithmic challenge platform. Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript (Strict)**, and **Tailwind CSS v4**.

---

## 1. Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.4+) or Node.js (v20+)
- Running Code0 backend (`/api-v1/*`) on `http://localhost:8000`

### Installation & Local Development

```bash
# Navigate to web application directory
cd web

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env.local

# Run development server
bun dev
```

The web client runs locally on `http://localhost:3000`.

### Typecheck, Lint & Build

```bash
# Typecheck TypeScript definitions with zero errors
bun run typecheck

# Lint codebase with ESLint
bun run lint

# Compile optimized standalone production build
bun run build
```

---

## 2. Environment Variables

All API communication is executed server-side; the browser never communicates with the backend directly.

| Variable | Scope | Default | Description |
|---|---|---|---|
| `API_BASE_URL` | Server Only | `http://localhost:8000` | Address of the backend FastAPI service. |
| `SERVER_ACTIONS_ALLOWED_ORIGINS` | Server Only | `localhost:3000,127.0.0.1:3000` | Comma-separated list of Host domains allowed by Next.js Server Actions behind reverse proxies. |

See `.env.example` for reference.

---

## 3. Access Matrix (Guest vs. Logged-in Users)

| Path / Action | Guest (Unauthenticated) | Logged-in User | Protection Layer |
|---|---|---|---|
| `/` (Landing & Hero) | Viewable | Viewable | Public |
| `/problems` (List & Filters) | Viewable with search & filters | Viewable with search & filters | Public |
| `/problems/[id]` (Workspace) | Can read statement & write code in editor | Can read statement & write code in editor | Public |
| `/problems/[id]` Run Action | Prompted with login modal & redirected to `/login?next=...` | Executes code against sample/custom cases | UI Guard + Route Handler (401) |
| `/problems/[id]` Submit Action | Prompted with login modal & redirected to `/login?next=...` | Submits code for official judging & score | UI Guard + Route Handler (401) |
| `/login` | View login form (password or OTP) | Redirected away to `/problems` | `proxy.ts` Middleware |
| `/register` | View registration form | Redirected away to `/problems` | `proxy.ts` Middleware |
| `/verify` | View OTP verification form | Redirected away to `/problems` | `proxy.ts` Middleware |
| `/profile` | Redirected to `/login?next=/profile` | View stats, rank, and edit account | `proxy.ts` Middleware + Server Component |
| `/api-v1/users/me` (PATCH) | Denied (401) | Allowed to edit `name`, `username`, `password` | Backend Auth + Server Action |

---

## 4. Architecture & Folder Structure

```
web/
├── Dockerfile                  # Multi-stage production container with standalone runner
├── next.config.ts              # Standalone output & Server Action origin configuration
├── package.json                # Dependencies and compilation scripts
├── postcss.config.mjs          # Tailwind CSS v4 PostCSS configuration
├── tsconfig.json               # Strict TypeScript configuration with @/* alias
├── .env.example                # Environment variable documentation
├── public/
│   ├── Code0.png               # Official Code0 brand logo
│   └── languages/              # Language runtime badges (c, cpp, java, python)
└── src/
    ├── proxy.ts                # Next.js 16+ Edge proxy/middleware (auth checks & JWT refresh)
    ├── app/
    │   ├── layout.tsx          # Root layout with ThemeProvider, Slim Navbar, and Footer
    │   ├── globals.css         # Design tokens, neutral palette, and electric blue brand accent
    │   ├── (marketing)/
    │   │   └── page.tsx        # Server-rendered landing page and truthful hero
    │   ├── (auth)/
    │   │   ├── login/page.tsx  # User login page (password & OTP support)
    │   │   ├── register/page.tsx # User registration with live username availability
    │   │   └── verify/page.tsx # Dedicated email OTP verification with resend cooldown
    │   ├── problems/
    │   │   ├── page.tsx        # Server-rendered paginated problem archive
    │   │   ├── _components/    # Problem search and filter bar
    │   │   └── [id]/
    │   │       ├── page.tsx    # Problem detail server shell
    │   │       ├── not-found.tsx # 404 state for invalid or missing problem IDs
    │   │       └── _components/
    │   │           ├── workspace-shell.tsx       # Resizable workspace & execution manager
    │   │           ├── monaco-code-editor.tsx    # Monaco editor leaf component with SSR disabled
    │   │           ├── problem-description.tsx  # Markdown renderer for statements
    │   │           ├── testcase-panel.tsx       # Sample cases and custom input editor
    │   │           ├── result-panel.tsx         # Detailed verdict, scores, stdout/stderr
    │   │           └── guest-login-modal.tsx    # Inline prompt for unauthenticated executions
    │   ├── profile/
    │   │   ├── page.tsx        # Profile overview & performance stats
    │   │   ├── actions.ts      # Profile update Server Action (PATCH /api-v1/users/me)
    │   │   └── _components/    # Profile edit form component
    │   └── api/
    │       └── code/
    │           ├── run/route.ts        # Authenticated proxy Route Handler for Run
    │           ├── submit/route.ts     # Authenticated proxy Route Handler for Submit
    │           └── poll/[id]/route.ts  # Polling Route Handler for execution results
    ├── components/
    │   ├── ui/                 # Resizable panels, buttons, badges
    │   └── shared/             # Slim Navbar, Footer, ThemeToggle, DifficultyBadge
    ├── lib/
    │   ├── api/                # Typed API clients for problems, leaderboard, and auth
    │   ├── auth/               # Session getters, cookie managers, and auth actions
    │   └── utils.ts            # ClassName merge helper (clsx + twMerge)
    └── types/                  # Strict TypeScript schemas matching backend endpoints
```

---

## 5. Security & Authentication Model

1. **Host-Only HTTP-Only Cookies**:
   - `access_token` (15-minute validity)
   - `refresh_token` (7-day validity)
   - Cookies are read via `headers.getSetCookie()` from backend responses and set via `cookies().set(...)` with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `secure: true` in production.
2. **Automatic Refresh**:
   - Primary: Evaluated in `proxy.ts`. If `access_token` is missing or expires within 30 seconds, `POST /api-v1/users/refresh` is called and rotated cookies are updated.
   - Fallback: Route Handlers and Server Actions refresh on 401 and retry once before invalidating the session.
3. **Execution Protection**:
   - A guest cannot invoke execution via direct API calls (`/api/code/run` and `/api/code/submit` verify session cookies and reject guests with 401).

---

## 6. Production Docker Deployment

```bash
# Build production image
docker build -t code0-web:latest -f Dockerfile .

# Run container
docker run -p 3000:3000 \
  -e API_BASE_URL=http://backend:8000 \
  -e SERVER_ACTIONS_ALLOWED_ORIGINS=code0.domain.com \
  code0-web:latest
```
