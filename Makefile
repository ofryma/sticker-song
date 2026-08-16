.PHONY: up down logs build reset migration backend-shell seed \
        dev dev-infra dev-infra-down dev-backend dev-frontend \
        test test-backend test-frontend lint lint-backend lint-frontend check \
        prod-pull prod-up prod-down prod-logs prod-deploy prod-health prod-version \
        prod-cert prod-cert-install prod-cert-renew \
        prod-backup prod-backup-install prod-backup-check prod-backup-prune \
        prod-snapshots prod-restore prod-restore-verify

# `.image-tag` holds the version the server runs (IMAGE_TAG=sha-...). The deploy
# workflow writes it before calling prod-deploy; it is created on demand with
# IMAGE_TAG=main so a hand-run stack works without CI. Later --env-file wins, so
# it overrides IMAGE_TAG in .env and nothing else.
IMAGE_TAG_FILE := .image-tag
PROD := docker compose -f docker-compose.prod.yml --env-file .env --env-file $(IMAGE_TAG_FILE)

$(IMAGE_TAG_FILE):
	@echo "IMAGE_TAG=main" > $@

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

prod-pull: $(IMAGE_TAG_FILE)   ## fetch the images named by IMAGE_REPO/IMAGE_TAG
	$(PROD) pull

prod-up: prod-pull         ## deploy or update the running stack
	$(PROD) up -d

prod-deploy: prod-up       ## what CI runs: pull, restart, reclaim disk
	$(PROD) ps
	docker image prune -f

prod-health:               ## block until the API answers, or fail after ~90s
	@for i in $$(seq 1 30); do \
	  if $(PROD) exec -T backend python -c \
	      'import urllib.request; urllib.request.urlopen("http://localhost:8000/health")' \
	      >/dev/null 2>&1; then echo "backend healthy"; exit 0; fi; \
	  sleep 3; \
	done; \
	echo "backend did not become healthy" >&2; \
	$(PROD) ps; $(PROD) logs --tail=80 backend init-db >&2; exit 1

prod-version:              ## print the version the running stack reports
	@$(PROD) exec -T backend python -c \
	  'import json, urllib.request; \
	   print(json.load(urllib.request.urlopen("http://localhost:8000/health"))["version"])'

prod-down:
	$(PROD) down

prod-logs:
	$(PROD) logs -f nginx backend

# --- TLS certificates, on the server -----------------------------------------
# Only the first certificate is a command anyone runs: after that the certbot
# service in docker-compose.prod.yml renews twice a day and nginx reloads on its
# own, so there is nothing in cron and nothing to remember.
#
# Issuance goes over the webroot the running nginx already serves — certbot
# writes the challenge into the shared certbot_webroot volume, nginx answers it
# from /.well-known/acme-challenge/ — so no port has to be freed. DNS has to
# point here first (`dig +short $(DOMAIN)`), or the challenge fails and burns an
# attempt against Let's Encrypt's rate limit. Add --dry-run to rehearse against
# staging, which has a far more generous limit.
#
# The domain is read from .env, the one place it is written.
DOMAIN ?= $(shell sed -n 's/^DOMAIN=//p' .env 2>/dev/null)
CERT_WEBROOT_VOLUME ?= $(notdir $(CURDIR))_certbot_webroot
CERTBOT := docker run --rm \
  -v $(CURDIR)/letsencrypt:/etc/letsencrypt \
  -v $(CERT_WEBROOT_VOLUME):/var/www/certbot \
  certbot/certbot

prod-cert:                 ## first certificate for DOMAIN: make prod-cert EMAIL=you@example.org
	@[ -n "$(DOMAIN)" ] || { echo "no DOMAIN in .env, and none given" >&2; exit 1; }
	@[ -n "$(EMAIL)" ] || { echo "usage: make prod-cert EMAIL=you@example.org" >&2; exit 1; }
	$(CERTBOT) certonly --webroot -w /var/www/certbot \
	  -d $(DOMAIN) -d www.$(DOMAIN) \
	  --email $(EMAIL) --agree-tos --no-eff-email $(CERTBOT_ARGS)
	@$(MAKE) --no-print-directory prod-cert-install

prod-cert-install:         ## put the certificate where nginx reads it, and reload
	$(PROD) run --rm init-certs
	-$(PROD) exec -T nginx nginx -s reload

prod-cert-renew:           ## force a renewal check now; the certbot service does this twice a day
	$(PROD) exec -T certbot certbot renew --webroot -w /var/www/certbot
	@$(MAKE) --no-print-directory prod-cert-install

# --- backups, on the server --------------------------------------------------
# Like the certificate, only the first command is one anyone runs: `sudo make
# prod-backup-install` puts two systemd timers in place, and after that the
# archive is copied to the drive nightly and a night that went missing says so
# in Telegram. `systemctl list-timers` is where they are, not cron.
#
# A timer rather than a service inside the compose file, unlike certbot, because
# the job needs both pg_dump and mc and no single image carries both — and this
# host must never build one. The logic is in ops/, in git, which is also what
# makes the restore reachable from a box that no longer exists.
#
# What is on the drive is visible in the review page's backups tab; these are
# for the times you are already on the box.

prod-backup:               ## copy the archive to the drive now
	ops/backup.sh

prod-backup-install:       ## one-time: install the nightly timer (needs sudo)
	ops/backup_install.sh

prod-backup-check:         ## warn if no backup has finished lately
	ops/backup_check.sh

prod-backup-prune:         ## reclaim deleted entries' photos: make prod-backup-prune GO=yes
	ops/backup_prune.sh

prod-snapshots:            ## what is on the drive
	@ops/snapshots.sh

prod-restore:              ## put the archive back: make prod-restore SNAPSHOT=latest
	@[ -n "$(SNAPSHOT)" ] || { echo "usage: make prod-restore SNAPSHOT=latest" >&2; exit 1; }
	CONFIRM="$(CONFIRM)" IMAGE_TAG="$(IMAGE_TAG)" ops/restore.sh --snapshot "$(SNAPSHOT)"

prod-restore-verify:       ## compare the running archive against a snapshot
	@[ -n "$(SNAPSHOT)" ] || { echo "usage: make prod-restore-verify SNAPSHOT=latest" >&2; exit 1; }
	@ops/restore_verify.sh --snapshot "$(SNAPSHOT)"
