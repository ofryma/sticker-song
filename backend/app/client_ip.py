from typing import Annotated

from fastapi import Depends, Request

from app.config import settings

UNKNOWN_IP = "unknown"


def get_client_ip(request: Request) -> str:
    """Best-effort client IP.

    Browser traffic reaches the backend through the Vite dev proxy, so without
    X-Forwarded-For every visitor looks like the frontend container. The proxy
    sets the header (``xfwd: true`` in vite.config.js) and we take the leftmost
    entry, which is the original client.
    """
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for", "")
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client is not None:
        return request.client.host
    return UNKNOWN_IP


ClientIpDep = Annotated[str, Depends(get_client_ip)]
