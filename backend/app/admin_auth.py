"""Admin authentication: a static token for scripts, a session token for the page.

Two ways in, both landing on `require_admin`:

* ``X-Admin-Token``, matched against ``ADMIN_TOKEN``. Unchanged; curl and CI use it.
* A signed session token from ``POST /admin/login``, obtained with
  ``ADMIN_USERNAME`` / ``ADMIN_PASSWORD``. The management page uses this so a
  browser never has to hold the long-lived token.

The session token is an HMAC over its own expiry, keyed by the password — so
nothing is stored server-side, and changing the password invalidates every issued
token. It is accepted from the ``Authorization: Bearer`` header, or from a
``token`` query parameter for image URLs, since an ``<img>`` tag cannot send one.
"""

import hashlib
import hmac
import secrets
import time
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Query, status

from app.config import settings

_SEPARATOR = "."


def _secret() -> bytes:
    """Signing key. The password is the only admin secret that must exist for
    sessions to work; ADMIN_TOKEN is mixed in so rotating either one is enough."""
    return f"{settings.admin_password}:{settings.admin_token}".encode()


def _sign(expires_at: int) -> str:
    payload = f"admin:{expires_at}".encode()
    return hmac.new(_secret(), payload, hashlib.sha256).hexdigest()


def issue_session_token() -> tuple[str, int]:
    """A fresh token and its expiry as a unix timestamp."""
    expires_at = int(time.time()) + settings.admin_session_hours * 3600
    return f"{expires_at}{_SEPARATOR}{_sign(expires_at)}", expires_at


def verify_credentials(username: str, password: str) -> bool:
    """Constant-time credential check. False when login is not configured."""
    if not settings.admin_login_enabled:
        return False
    return secrets.compare_digest(username, settings.admin_username) and (
        secrets.compare_digest(password, settings.admin_password)
    )


def _valid_session(token: str) -> bool:
    expiry, separator, signature = token.partition(_SEPARATOR)
    if not separator or not settings.admin_login_enabled:
        return False
    try:
        expires_at = int(expiry)
    except ValueError:
        return False
    if expires_at < time.time():
        return False
    return secrets.compare_digest(signature, _sign(expires_at))


def _valid_static_token(token: str) -> bool:
    return bool(settings.admin_token) and secrets.compare_digest(
        token, settings.admin_token
    )


async def require_admin(
    x_admin_token: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
    token: Annotated[str | None, Query(include_in_schema=False)] = None,
) -> None:
    """Allow the request through if any of the three credentials checks out."""
    if not settings.admin_token and not settings.admin_login_enabled:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "Admin API is disabled: set ADMIN_TOKEN, or ADMIN_USERNAME and "
            "ADMIN_PASSWORD",
        )

    bearer = None
    if authorization and authorization.lower().startswith("bearer "):
        bearer = authorization.split(" ", 1)[1].strip()

    candidates = [value for value in (x_admin_token, bearer, token) if value]
    for value in candidates:
        if _valid_static_token(value) or _valid_session(value):
            return

    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid admin credentials")


AdminDep = Annotated[None, Depends(require_admin)]
