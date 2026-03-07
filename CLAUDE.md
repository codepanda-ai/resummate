# CLAUDE.md - Resummate Project Guide

## Project Overview

Resummate is an AI-powered resume review platform that helps job seekers create top-tier applications. Users upload resumes (PDF, DOCX, TXT) and job descriptions, then receive interactive coaching via a chat interface — including ATS optimization, keyword alignment, action verb enhancement, and section-by-section feedback powered by Google Gemini.

- **Frontend:** Next.js 16 (App Router) with React 19, TypeScript
- **Backend:** FastAPI (Python) REST API
- **AI:** Google Gemini API via `google-genai`
- **Database:** Supabase PostgreSQL
- **Auth:** Stack Auth (`@stackframe/stack`)
- **Deployment:** Vercel (frontend + serverless Python backend)
- **Package Manager:** pnpm (v9.12.3)

## Quick Start

```bash
# Install frontend dependencies
pnpm install

# Install backend dependencies
pip3 install -r requirements.txt

# Run both frontend and backend concurrently
pnpm dev

# Or run separately:
pnpm next-dev        # Next.js on :3000
pnpm fastapi-dev     # FastAPI on :8000
```

## Key Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start both Next.js and FastAPI concurrently |
| `pnpm build` | Build Next.js for production |
| `pnpm lint` | Run ESLint |
| `ANALYZE=true pnpm build` | Build with bundle analyzer |

## Project Structure

```
├── app/                    # Next.js App Router (frontend pages/routes)
│   ├── (chat)/             # Main chat page (route group)
│   ├── [uuid]/             # Dynamic route
│   ├── handler/[...stack]/ # Stack Auth handler
│   ├── og/                 # OpenGraph image route
│   ├── layout.tsx          # Root layout (Stack Provider, theme)
│   └── globals.css         # Global Tailwind styles
│
├── api/                    # FastAPI backend (Python)
│   ├── main.py             # FastAPI app entry point
│   ├── index.py            # Vercel serverless wrapper
│   ├── auth/               # Stack Auth integration
│   ├── core/               # Config, dependencies, logging, schemas
│   ├── db/                 # Supabase database service
│   ├── services/           # Gemini AI, prompts, tools
│   ├── chat/               # Chat domain router
│   ├── resume/             # Resume domain router
│   ├── job_description/    # Job description domain router
│   └── user/               # User domain router
│
├── components/             # Shared React components
│   ├── ui/                 # shadcn/ui primitives (button, textarea, etc.)
│   ├── chat.tsx            # Main chat component
│   ├── message.tsx         # Message rendering
│   ├── multimodal-input.tsx # Input with file upload
│   └── navbar.tsx          # Top navigation
│
├── lib/                    # Frontend utilities
│   ├── utils.ts            # cn(), sanitizeUIMessages()
│   └── auth-headers.ts     # API auth header helpers
│
├── hooks/                  # Custom React hooks
├── stack/                  # Stack Auth client/server setup
└── assets/                 # Static assets
```

## Architecture & Conventions

### Frontend (TypeScript/React)

- **Server Components first.** Only use `'use client'` at the lowest necessary component.
- **Path alias:** `@/*` maps to the project root (e.g., `@/components/ui/button`).
- **Styling:** Tailwind CSS v4 with `cn()` from `lib/utils.ts` for class merging. shadcn/ui for UI primitives.
- **State:** Local `useState` preferred. SWR for client-side data fetching.
- **Navigation:** Always use `next/link` `<Link>`, never `<a>` for internal routes.
- **Images:** Always use `next/image`, never `<img>`.
- **Auth:** Stack Auth wraps the app via `StackProvider` in root layout. Use `ChatAuthGuard` for protected routes.

### Backend (Python/FastAPI)

- **Domain-driven structure:** Each domain (chat, resume, job_description, user) has its own `router.py`.
- **Config:** `pydantic-settings` in `api/core/config.py`, reads from environment variables.
- **Dependencies:** Use FastAPI `Depends()` for injection (DB sessions, auth, etc.).
- **Auth:** Stack Auth verification in `api/auth/stack_auth.py`. All API endpoints require authentication.
- **Async-first:** Use `async`/`await` for I/O-bound operations.
- **Error handling:** Raise `HTTPException` with proper status codes, never generic Python exceptions.
- **Type hints:** Mandatory on all function signatures. Use Pydantic models for request/response schemas.

### API Routing

In development, Next.js rewrites `/api/*` to `http://127.0.0.1:8000/api/*` (the FastAPI server). In production, Vercel serves the FastAPI backend as serverless functions from the `api/` directory.

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/chat` | Stream chat responses |
| `POST` | `/api/generate` | Generate non-streaming responses |
| `GET` | `/api/chat/history/{thread_id}` | Get message history |
| `POST` | `/api/resume/upload` | Upload resume file (PDF/DOCX/TXT) |
| `GET` | `/api/resume/{thread_id}` | Get resume info |
| `DELETE` | `/api/resume/{thread_id}` | Delete resume |
| `POST` | `/api/job-description/upload` | Upload job description |
| `GET` | `/api/job-description/{thread_id}` | Get job description info |
| `DELETE` | `/api/job-description/{thread_id}` | Delete job description |

### Database (Supabase PostgreSQL)

- Use `snake_case` for all table/column names.
- Lowercase SQL keywords.
- Always index foreign keys.
- Enable Row-Level Security on all tables.

## Environment Variables

Configured in `.env.local`. See `.env.example` for the full template.

**Vercel/Infra (from `.env.example`):**
- `AUTH_SECRET` - Authentication secret
- `AI_GATEWAY_API_KEY` - Vercel AI Gateway key
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage
- `POSTGRES_URL` - Supabase PostgreSQL connection string
- `REDIS_URL` - Redis store URL

**Backend (from `api/core/config.py`):**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_PUBLISHABLE_DEFAULT_KEY` - Supabase anon key
- `GOOGLE_GENERATIVE_AI_API_KEY` - Google Gemini API key
- `GEMINI_MODEL` - Model name (default: `gemini-2.5-flash-lite`)
- `MAX_OUTPUT_TOKENS` - Max tokens per response (default: `512`)
- `DEFAULT_TEMPERATURE` - AI temperature (default: `0.5`)
- `MAX_UPLOAD_SIZE` - Max file upload in bytes (default: `10485760` / 10MB)
- `LOG_LEVEL` - Logging level (default: `INFO`)

## Code Quality

- **Linting:** ESLint with `eslint-config-next/core-web-vitals` and TypeScript rules.
- **Formatting:** Biome (`@biomejs/biome`).
- **TypeScript:** Strict mode enabled.
- **Python:** All functions must have docstrings (Args, Returns, Raises) and complete type hints.
- Run `pnpm lint` before committing.

## Testing

No test suite is set up yet. To add backend tests, use pytest with FastAPI's `TestClient`:

```python
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
```

Frontend E2E testing uses Playwright (`@playwright/test`).

## Deployment

- Deployed on Vercel with Git integration.
- `vercel.json` excludes `.next`, `.git`, `node_modules` from Python function bundles.
- Use Preview Deployments for PRs before merging to `main`.
