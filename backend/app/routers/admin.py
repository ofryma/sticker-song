import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select

from app.config import settings
from app.db import SessionDep
from app.models import BlacklistedIp
from app.schemas import BlacklistCreate, BlacklistRead


async def require_admin(
    x_admin_token: Annotated[str | None, Header()] = None,
) -> None:
    if not settings.admin_token:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Admin API is disabled: ADMIN_TOKEN is not set",
        )
    if x_admin_token is None or not secrets.compare_digest(
        x_admin_token, settings.admin_token
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin token")


router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)]
)


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
