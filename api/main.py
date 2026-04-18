"""
Main FastAPI application entry point.
"""

from fastapi import FastAPI, Request as FastAPIRequest, status, Depends
from vercel.headers import set_headers

from api.chat.router import router as chat_router
from api.resume.router import router as resume_router
from api.job_description.router import router as job_description_router
from api.user.router import router as user_router
from api.session.router import router as session_router
from api.core.config import settings
from api.core.logging import log_info, logger
from api.core.schemas import HealthCheckResponse
from api.auth.stack_auth import verify_stack_token

import sentry_sdk

sentry_sdk.init(
    dsn=settings.SENTRY_DSN,
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=False,
    environment=settings.ENVIRONMENT,
)

app = FastAPI(
    title="Resummate API",
    description="AI-powered resume optimization API",
    version="1.0.0",
)


@app.middleware("http")
async def vercel_headers_middleware(request: FastAPIRequest, call_next):
    """
    Middleware to set Vercel headers.

    Args:
        request: FastAPI request
        call_next: Next middleware in chain

    Returns:
        Response from next middleware
    """
    set_headers(dict(request.headers))
    return await call_next(request)


# Include routers
app.include_router(chat_router)
app.include_router(resume_router)
app.include_router(job_description_router)
app.include_router(user_router)
app.include_router(session_router)


@app.get(
    "/api/health",
    response_model=HealthCheckResponse,
    status_code=status.HTTP_200_OK,
    tags=["health"],
)
async def health_check() -> HealthCheckResponse:
    """
    Health check endpoint.

    Returns:
        HealthCheckResponse: Health status
    """
    log_info("Health check called", extra={"endpoint": "/api/health"})
    return HealthCheckResponse(status="healthy")

@app.get("/api/sentry-debug")
async def trigger_error(auth_user: dict = Depends(verify_stack_token)):
    """
    Trigger a test error for Sentry.
    """
    division_by_zero = 1 / 0

@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    logger.info("Starting Resummate API")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    logger.info("Shutting down Resummate API")
