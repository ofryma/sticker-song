from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.client_ip import ClientIpDep
from app.db import SessionDep
from app.models import BlacklistedIp


async def require_not_blacklisted(session: SessionDep, client_ip: ClientIpDep) -> str:
    """Reject blacklisted IPs; return the caller's IP for the route to record."""
    banned = await session.get(BlacklistedIp, client_ip)
    if banned is not None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Submissions from your IP are blocked: {banned.reason}",
        )
    return client_ip


# Routes that write depend on this instead of ClientIpDep: one dependency both
# enforces the blacklist and hands back the IP.
AllowedIpDep = Annotated[str, Depends(require_not_blacklisted)]
