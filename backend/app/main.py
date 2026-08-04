import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import admin, entries

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
app.include_router(admin.router)


@app.on_event("startup")
async def warn_about_admin_token() -> None:
    if not settings.admin_token:
        logger.warning("ADMIN_TOKEN is not set: /admin endpoints are disabled")
    elif settings.admin_token == "devtoken":
        logger.warning("ADMIN_TOKEN is still the development default: never deploy this")


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
