"""Initialization sidecar: wait for Postgres, migrate, create the MinIO bucket.

Run as ``python -m app.init_infra``. Exits 0 on success, 1 on failure.
"""

import socket
import sys
import time
from urllib.parse import urlsplit

from alembic import command
from alembic.config import Config

from app import storage
from app.config import settings

RETRIES = 60
DELAY_SECONDS = 2.0


def wait_for_port(host: str, port: int, label: str) -> None:
    for attempt in range(1, RETRIES + 1):
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"[init] {label} is reachable at {host}:{port}")
                return
        except OSError:
            print(f"[init] waiting for {label} ({attempt}/{RETRIES})...")
            time.sleep(DELAY_SECONDS)
    raise RuntimeError(f"{label} not reachable at {host}:{port}")


def wait_for_postgres() -> None:
    parts = urlsplit(settings.database_url)
    wait_for_port(parts.hostname or "localhost", parts.port or 5432, "postgres")


def wait_for_minio() -> None:
    host, _, port = settings.minio_endpoint.partition(":")
    wait_for_port(host, int(port or 9000), "minio")


def run_migrations() -> None:
    print("[init] running alembic upgrade head")
    command.upgrade(Config("alembic.ini"), "head")
    print("[init] migrations applied")


def main() -> int:
    try:
        wait_for_postgres()
        run_migrations()
        wait_for_minio()
        storage.ensure_bucket()
        print(f"[init] bucket '{settings.minio_bucket}' is ready")
    except Exception as exc:  # noqa: BLE001 - sidecar reports and fails loudly
        print(f"[init] failed: {exc}", file=sys.stderr)
        return 1
    print("[init] initialization complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
