import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, admin_messages, conflicts, entries, messages, moderation

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Memorial Stickers API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(entries.router)
app.include_router(messages.router)
app.include_router(admin.login_router)
app.include_router(admin.router)
app.include_router(moderation.router)
app.include_router(conflicts.router)
app.include_router(admin_messages.router)


@app.on_event("startup")
async def warn_about_admin_token() -> None:
    if not settings.admin_token and not settings.admin_login_enabled:
        logger.warning(
            "No admin credentials: /admin is disabled, and nothing can review or "
            "publish a submission"
        )
    elif settings.admin_token == "devtoken":
        logger.warning("ADMIN_TOKEN is still the development default: never deploy this")
    if not settings.admin_login_enabled:
        logger.warning(
            "ADMIN_USERNAME/ADMIN_PASSWORD are not set: the /admin page cannot sign in"
        )
    if not settings.review_enabled:
        logger.info("ANTHROPIC_API_KEY is not set: drafts get no LLM note")


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
