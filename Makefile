.PHONY: up down logs build reset migration backend-shell \
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

# --- production, on the server (needs .env; see .env.prod.example) ------------

prod-pull:                 ## fetch the images named by IMAGE_REPO/IMAGE_TAG
	$(PROD) pull

prod-up: prod-pull         ## deploy or update the running stack
	$(PROD) up -d

prod-down:
	$(PROD) down

prod-logs:
	$(PROD) logs -f nginx backend
