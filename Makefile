.PHONY: up down logs build reset migration backend-shell seed \
        test test-backend test-frontend lint lint-backend lint-frontend check \
        prod-pull prod-up prod-down prod-logs

PROD := docker compose -f docker-compose.prod.yml

up:
	docker compose up --build

down:
	docker compose down

reset:                     ## stop everything and delete database + object storage
	docker compose down -v

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
