FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies first so code changes don't invalidate the layer.
# --frozen installs exactly what uv.lock pins and never re-resolves, so an image
# built from a given commit today matches one built from it next year. Note it
# does NOT verify the lock against pyproject.toml — a dependency added without
# re-locking is silently absent from the image. CI runs `uv sync --locked`,
# which fails on a stale lock, so that cannot reach main unnoticed.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
