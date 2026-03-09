# Resummate

> Ace your next interview with AI-powered coaching and realistic mock sessions

## Overview

Resummate is an AI-powered interview coaching platform that helps job seekers prepare for and excel in interviews. Users upload their resume and a target job description, then engage in personalized mock interview sessions — complete with role-specific questions, real-time answer feedback, and comprehensive post-session performance reports powered by Google Gemini.

## Product Features

### AI Interview Coach
- **Mock Interview Sessions**: Realistic, role-specific interviews tailored to your resume and target job
- **Real-Time Feedback**: Instant coaching on answer clarity, relevance, and delivery
- **Adaptive Questioning**: Dynamic follow-up questions based on your responses
- **Performance Reports**: Detailed post-session analysis with strengths, areas for improvement, and scores
- **Role & Industry Awareness**: Questions and feedback calibrated to the specific job description

### User Experience
1. **Upload Resume & Job Description**: Support for PDF, DOCX, and TXT formats
2. **Start Mock Interview**: AI interviewer conducts a realistic session based on your materials
3. **Real-Time Coaching**: Receive immediate guidance after each answer
4. **Performance Report**: Get a comprehensive debrief with actionable next steps

## Technical Architecture

### Technology Stack

**Frontend**
- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Features**: Server-side rendering, API routes, optimized performance, responsive design

**Backend**
- **Framework**: FastAPI
- **Language**: Python
- **Deployment**: Vercel (Serverless Functions)
- **Features**: High-performance REST API, async request handling

**Authentication**
- **Provider**: [Stack Auth](https://stack-auth.com/)
- **Features**: Open-source authentication, user management, password/SSO/2FA, organizations & teams, permissions & RBAC
- **Benefits**: Seamless integration, beautiful pre-built components, headless SDK option

**AI & Machine Learning**
- **Provider**: Google Gemini API
- **Capabilities**: Natural language understanding, document parsing, interview question generation, answer evaluation, performance reporting

**Database**
- **Platform**: Supabase PostgreSQL
- **Features**: Persistent storage, real-time capabilities, row-level security
- **Data**: User profiles, uploaded documents, interview sessions, performance reports

---

## API Documentation

### Project Structure

```
api/
├── agents/                  # AI agent logic
│   ├── interview_agent.py  # Mock interview conductor
│   ├── report_agent.py     # Post-session performance reporter
│   └── context.py          # Session context management
├── chat/                    # Chat domain
│   ├── __init__.py
│   └── router.py           # Chat endpoints
├── resume/                  # Resume domain
│   ├── __init__.py
│   └── router.py           # Resume endpoints
├── job_description/         # Job description domain
│   ├── __init__.py
│   └── router.py           # Job description endpoints
├── session/                 # Interview session domain
│   ├── __init__.py
│   └── router.py           # Session endpoints
├── core/                    # Core application modules
│   ├── __init__.py
│   ├── config.py           # Configuration using pydantic-settings
│   ├── dependencies.py     # Dependency injection providers
│   ├── logging.py          # Structured logging setup
│   └── schemas.py          # Shared Pydantic models
├── db/                      # Database layer
│   ├── __init__.py
│   └── service.py          # Supabase database operations
├── services/                # Business logic layer
│   ├── __init__.py
│   ├── gemini.py           # Gemini AI service
│   ├── prompts.py          # System prompts and utilities
│   └── tools.py            # AI function calling tools
├── main.py                  # Main application entry point
└── index.py                 # Vercel serverless wrapper
```

### Architecture Principles

This codebase follows FastAPI best practices:

#### 1. Domain-Driven Organization
- Code is organized by domain (chat, resume, job_description) rather than by file type
- Each domain has its own router
- Shared code lives in `core/`, `db/`, and `services/`

#### 2. Type Safety
- All functions have complete type hints
- Pydantic models are used for all request/response validation
- Type aliases (`SupabaseClient`, `GeminiClient`) simplify dependency injection

#### 3. Dependency Injection
- Database and AI clients are injected via FastAPI's `Depends`
- No global state or direct instantiation in routers
- Makes code testable and modular

#### 4. Consistent API Structure
- All endpoints follow REST conventions under `/api/`
- Organized by domain (chat, resume, job-description)

#### 5. Error Handling
- Consistent use of `HTTPException` with appropriate status codes
- Structured error responses
- Comprehensive error logging with traceback

#### 6. Structured Logging
- Centralized logging configuration in `core/logging.py`
- Context-aware logging with extra fields
- Easy integration with log aggregation services

#### 7. Configuration Management
- All configuration in `core/config.py` using `pydantic-settings`
- Environment variables loaded from `.env.local`
- Type-safe access to configuration values

#### 8. Service Layer Pattern
- Business logic separated from HTTP layer
- Routers are thin and focused on HTTP concerns
- Services in `services/` handle complex operations
- Database operations isolated in `db/service.py`

### Environment Variables

Required environment variables (set in `.env.local`):

```bash
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_key

# Google Gemini AI
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# Optional Configuration
GEMINI_MODEL=gemini-2.5-flash-lite
MAX_OUTPUT_TOKENS=512
DEFAULT_TEMPERATURE=0.5
MAX_UPLOAD_SIZE=10485760  # 10MB in bytes
LOG_LEVEL=INFO
```

### API Endpoints

#### Health Check
- `GET /api/health` - Health check endpoint

#### Chat
- `POST /api/chat` - Stream chat responses
- `POST /api/generate` - Generate non-streaming responses
- `GET /api/chat/history/{thread_id}` - Get message history

#### Resume
- `POST /api/resume/upload` - Upload resume file
- `GET /api/resume/{thread_id}` - Get resume info
- `DELETE /api/resume/{thread_id}` - Delete resume

#### Job Description
- `POST /api/job-description/upload` - Upload job description
- `GET /api/job-description/{thread_id}` - Get job description info
- `DELETE /api/job-description/{thread_id}` - Delete job description

#### Interview Session
- `POST /api/session/start` - Start a new interview session
- `POST /api/session/{session_id}/respond` - Submit answer and get next question
- `POST /api/session/{session_id}/end` - End session and generate report
- `GET /api/session/{session_id}/report` - Get post-session performance report

### Development

#### Installation

```bash
pip install -r requirements.txt
```

#### Running Locally

```bash
uvicorn api.main:app --reload --port 8000
```

#### Production Deployment

The application is deployed on Vercel. The `api/index.py` file serves as a compatibility wrapper for Vercel's serverless functions.

### Code Quality

- All functions have docstrings with Args, Returns, and Raises sections
- Type hints on all function signatures
- Consistent error handling patterns
- Comprehensive logging for debugging

### Testing

To add tests, create a `tests/` directory with pytest:

```python
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
```

---

## License

MIT License

## Contact

For technical questions or support, contact dan.deng.wei@gmail.com

---

Built with ❤️ to help job seekers ace their interviews