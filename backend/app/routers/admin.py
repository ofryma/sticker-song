from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.admin_auth import issue_session_token, require_admin, verify_credentials
from app.config import settings
from app.db import SessionDep
from app.models import BlacklistedIp
from app.schemas import AdminLogin, AdminSession, BlacklistCreate, BlacklistRead

# Login is the one admin route that cannot require an admin credential.
login_router = APIRouter(prefix="/admin", tags=["admin"])


@login_router.post("/login", response_model=AdminSession)
async def login(payload: AdminLogin) -> AdminSession:
    """Exchange the configured username and password for a short-lived token.

    Lets the management page hold a token that expires on its own instead of the
    long-lived ADMIN_TOKEN.
    """
    if not settings.admin_login_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Admin sign-in is disabled: set ADMIN_USERNAME and ADMIN_PASSWORD",
        )
    if not verify_credentials(payload.username, payload.password):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Incorrect username or password"
        )

    token, expires_at = issue_session_token()
    return AdminSession(token=token, expires_at=datetime.fromtimestamp(expires_at, UTC))


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/session")
async def check_session() -> dict[str, bool]:
    """Whether the credential the caller sent is still good — the page calls this
    on load to decide between the sign-in form and the queue."""
    return {"valid": True}


@router.post(
    "/blacklist", response_model=BlacklistRead, status_code=status.HTTP_201_CREATED
)
async def add_to_blacklist(
    session: SessionDep, payload: BlacklistCreate
) -> BlacklistedIp:
    ip = str(payload.ip)
    existing = await session.get(BlacklistedIp, ip)
    if existing is not None:
        # Idempotent: refresh the reason rather than erroring.
        existing.reason = payload.reason
        await session.commit()
        await session.refresh(existing)
        return existing

    banned = BlacklistedIp(ip=ip, reason=payload.reason)
    session.add(banned)
    await session.commit()
    await session.refresh(banned)
    return banned


@router.get("/blacklist", response_model=list[BlacklistRead])
async def list_blacklist(session: SessionDep) -> list[BlacklistedIp]:
    result = await session.scalars(
        select(BlacklistedIp).order_by(BlacklistedIp.created_at.desc())
    )
    return list(result)


@router.delete("/blacklist/{ip}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_blacklist(session: SessionDep, ip: str) -> None:
    banned = await session.get(BlacklistedIp, ip)
    if banned is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "IP is not blacklisted")
    await session.delete(banned)
    await session.commit()
