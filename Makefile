.PHONY: up down logs build reset migration backend-shell seed \
        dev dev-infra dev-infra-down dev-backend dev-frontend \
        test test-backend test-frontend lint lint-backend lint-frontend check \
        prod-pull prod-up prod-down prod-logs

PROD := docker compose -f docker-compose.prod.yml

# Host ports the compose infra publishes; keep in sync with docker-compose.yml.
POSTGRES_PORT ?= 5442
MINIO_PORT    ?= 9010
BACKEND_PORT  ?= 8000

# Environment for a backend running on the host against the containerised
# infra. Everything else falls back to backend/app/config.py defaults.
DEV_ENV := \
  DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:$(POSTGRES_PORT)/stickers \
  MINIO_ENDPOINT=localhost:$(MINIO_PORT) \
  MINIO_SECURE=false \
  ADMIN_TOKEN=$${ADMIN_TOKEN:-devtoken} \
  ADMIN_USERNAME=$${ADMIN_USERNAME:-admin} \
  ADMIN_PASSWORD=$${ADMIN_PASSWORD:-admin}

up:
	docker compose up --build

down:
	docker compose down

reset:                     ## stop everything and delete database + object storage
	docker compose down -v~

build:
	docker compose build

logs:
	docker compose logs -f backend frontend

migration:                 ## make migration m="add column"
	docker compose run --rm init-db alembic revision --autogenerate -m "$(m)"

backend-shell:
	docker compose exec backend bash

seed:                      ## seed the wall: make seed m=seed/entries.json
	docker compose run --rm -v $(PWD)/backend/seed:/app/seed init-db python -m app.seed "$(m)"

# --- local development, outside the containers -------------------------------
# Postgres and MinIO stay in docker; backend and frontend run on the host with
# hot reload, so an edit is live without a rebuild.

dev: dev-infra             ## run backend + frontend locally with hot reload
	@echo "backend  http://localhost:$(BACKEND_PORT)"
	@echo "frontend http://localhost:5173"
	@trap 'kill 0' EXIT INT TERM; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-frontend & \
	wait

dev-infra:                 ## postgres + minio in docker, migrated and bucketed
	docker compose up -d postgres minio
	docker compose run --rm init-db

dev-infra-down:            ## stop the containerised postgres + minio
	docker compose stop postgres minio

dev-backend:               ## uvicorn --reload against the containerised infra
	cd backend && $(DEV_ENV) uv run uvicorn app.main:app \
	  --reload --host 0.0.0.0 --port $(BACKEND_PORT)

dev-frontend:              ## vite dev server, proxying /api to the local backend
	cd frontend && [ -d node_modules ] || npm install; \
	BACKEND_URL=http://localhost:$(BACKEND_PORT) npm run dev

# --- tests and linters (what CI runs) ----------------------------------------

test: test-backend test-frontend   ## run both test suites

test-backend:              ## integration tests need `docker compose up postgres minio`
	cd backend && uv run pytest

test-frontend:             ## vitest: the draft flow and the duplicate review
	cd frontend && npm run test

lint: lint-backend lint-frontend

lint-backend:
	cd backend && uv run ruff check . && uv run ruff format --check .

lint-frontend:             ## eslint, prettier, 300-line limit, he/en key parity
	cd frontend && npm run check

check: lint test           ## everything CI checks, in one go

# --- production, on the server (needs .env; see .env.prod.example) ------------

prod-pull:                 ## fetch the images named by IMAGE_REPO/IMAGE_TAG
	$(PROD) pull

prod-up: prod-pull         ## deploy or update the running stack
	$(PROD) up -d

prod-down:
	$(PROD) down

prod-logs:
	$(PROD) logs -f nginx backend
