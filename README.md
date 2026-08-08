# Memorial Stickers — MVP

Document memorial stickers of fallen individuals found in public: upload a photo,
record the person's name and the sticker's text, and optionally attach the GPS
location where the photo was taken.

## Intent

The archive exists to remember these people in a good and positive way. It is
respectful and dignified, and it is deliberately **not** sad — the aim is to
celebrate lives rather than dwell on how they ended. In practice that means:

- **A light, warm theme.** Parchment and Jerusalem stone in daylight (`day-*`
  surfaces, `ink-*` text), with olive for growth, sun for warmth and tekhelet for
  action. There is no dark surface anywhere, and photographs are shown whole and
  in full colour — never dimmed, never greyscaled, never written across.
- **Positive gestures.** The remembering gesture is a leaf: a visitor adds a leaf
  to a person, it grows into place, and it stays on their device and is never
  counted. New features belong to the same family — life, growth, continuity, a
  memory added alongside a photo — not to rituals of grief.
- **Copy that centres the person.** Plain, warm, human. No exclamation marks, no
  emoji, no gamification: warmth comes from light and language, not confetti.

`.claude/rules/frontend.md` is the binding version of this for anyone, human or
agent, touching the frontend, and it carries the full token map.

## Stack

| Piece          | Choice                                        |
| -------------- | --------------------------------------------- |
| Frontend       | React 18 + Vite + Tailwind, mobile-first, he/en |
| Backend        | FastAPI, SQLAlchemy 2.x (async), Pydantic v2  |
| Database       | PostgreSQL 16, migrated with Alembic          |
| Object storage | MinIO (S3-compatible); DB stores only the key |
| Packaging      | Docker Compose, `uv` for Python deps          |

## Quick start

```bash
docker compose up --build
```

Then open <http://localhost:5173>.

No `.env` is required — every variable has a working default. Copy `.env.example`
to `.env` to change ports or credentials.

| Service        | URL                                            |
| -------------- | ---------------------------------------------- |
| Frontend       | <http://localhost:5173>                        |
| Review page    | <http://localhost:5173/admin> (admin/admin)    |
| API + docs     | <http://localhost:8000/docs>                   |
| MinIO console  | <http://localhost:9011> (minioadmin/minioadmin) |
| Postgres       | `localhost:5442`                               |

Host ports for Postgres (5442) and MinIO (9010/9011) are shifted off the usual
defaults to avoid clashing with other local services; change them in `.env`.

## Startup order

`docker compose up` wires the dependencies so a cold start needs no manual steps:

1. `postgres` and `minio` start and become healthy.
2. `init-db` waits for both, runs `alembic upgrade head`, creates the bucket if
   missing, and exits 0.
3. `backend` starts only after `init-db` completed successfully.
4. `frontend` starts and proxies `/api/*` to the backend.

Re-running `init-db` is safe: migrations and bucket creation are both idempotent.

## API

| Method | Path                   | Notes                                          |
| ------ | ---------------------- | ---------------------------------------------- |
| POST   | `/entries`             | `multipart/form-data`: `image`, `person_name`, `sticker_text`, optional `latitude`/`longitude`. Creates a **draft** |
| GET    | `/entries`             | The wall: published only, newest first; `limit` (≤200) and `offset` |
| GET    | `/entries/{id}`        | Single published entry                         |
| GET    | `/entries/{id}/image`  | The full-size image out of MinIO               |
| GET    | `/entries/{id}/thumb`  | The small copy, for grids and the collage      |
| GET    | `/entries/{id}/duplicates` | Possible duplicates of an existing entry   |
| POST   | `/entries/{id}/feedback`   | Vote "this is the best image for this person" |
| GET    | `/health`              | Liveness                                       |
| POST   | `/admin/login`         | `{username, password}` → a short-lived session token |
| GET    | `/admin/session`       | Whether the caller's credential is still valid |
| GET    | `/admin/entries`       | One page of the review queue: `{items, total, limit, offset}`. Filter with `status` = `pending` (default) / `published` / `rejected` / `all`, `q` (name or sticker text), `read` = `any` / `flag` / `ok` / `error` / `unread`, `added_within_days`; order with `sort` = `added` / `name` / `status` / `read` and `order` = `asc` / `desc`; page with `limit` (≤200) and `offset` |
| GET    | `/admin/entries/counts`| How many entries sit in each state             |
| POST   | `/admin/entries/{id}/publish` | Put the entry on the wall; optional `{note}` |
| POST   | `/admin/entries/{id}/reject`  | Keep it out of the archive without deleting it |
| POST   | `/admin/entries/{id}/analyze` | Re-run the LLM read on the entry        |
| DELETE | `/admin/entries/{id}`  | Permanent takedown: row and both images, no undo |
| GET    | `/admin/entries/{id}/image` | A draft's photo, whatever its state       |
| GET    | `/admin/entries/{id}/thumb` | The same, small                           |
| GET    | `/admin/conflicts`     | People the archive holds more than one sticker for, grouped on the normalized name; `q`, `limit`, `offset`. Near-matching names travel with a group as `similar_names` and are never merged into it |
| GET    | `/admin/conflicts/entries` | Every sticker under one `name` (the normalized key), with each one's votes and a `suggested_best_id` |
| POST   | `/admin/conflicts/resolve` | Keep `winner_id`, permanently remove `loser_ids`. Every loser must carry the winner's name |
| POST   | `/admin/blacklist`     | `{ip, reason}` — bar an IP from submitting     |
| GET    | `/admin/blacklist`     | List blocked IPs and reasons                   |
| DELETE | `/admin/blacklist/{ip}`| Unban                                          |

Images are served through the backend rather than by presigned MinIO URLs, so the
browser never needs to reach MinIO directly.

**Image normalization.** `app/images.py` decodes every upload and identifies its
real format from the bytes — the `Content-Type` header and filename suffix are
treated as hints only. Whatever comes in (JPEG, PNG, WebP, GIF, BMP, TIFF, HEIC
from iPhones) is re-encoded into the single format set by `IMAGE_FORMAT`
(`webp` by default, at `IMAGE_QUALITY`), so the bucket holds one format and one
extension. Along the way EXIF orientation is applied and all metadata — GPS
included — is dropped; animated input keeps its first frame. Anything that
cannot be decoded is a 400, and the stored width/height/bytes describe the
converted image. Every upload also gets a thumbnail (longest edge
`THUMBNAIL_MAX_EDGE`, 640 by default) in the same format, which is what the wall
grid and the collage load. Contributors need no authentication; the `/admin`
routes take either an `X-Admin-Token` header or a session token from
`/admin/login` (as `Authorization: Bearer`, or a `?token=` query parameter for
`<img>` URLs).

Example:

```bash
curl -X POST localhost:8000/entries \
  -F "image=@sticker.jpg" \
  -F "person_name=Full Name" \
  -F "sticker_text=Text written on the sticker" \
  -F "latitude=32.0853" -F "longitude=34.7818"
```

## Review before publication

**Every submission is a draft.** `POST /entries` stores the entry with
`status: "pending"` and returns `awaiting_review: true`; it is not on the wall, not
in `GET /entries`, not offered as a duplicate candidate, and not votable. A person
publishes it from the review page at `/admin`. That way nothing offensive or
half-finished is ever public, even briefly.

A draft is readable by exactly two parties: an admin, and the IP that submitted it —
so the contributor still sees their own entry on the thank-you screen. Everyone else
gets a 404, because a draft's existence is not public either. Setting
`REQUIRE_REVIEW=false` publishes on upload instead, which the project deliberately
avoids.

**The review page.** `/admin` is a normal route in the SPA, linked from nowhere. It
signs in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` and holds a token that expires
after `ADMIN_SESSION_HOURS`; the token is an HMAC over its own expiry keyed by the
password, so nothing is stored server-side and changing the password invalidates
every issued token. The page shows each draft's photograph, name and transcription,
and offers four actions: publish, hold back (`rejected` — kept, so a resubmission is
not silently re-reviewed), re-read with the LLM, and delete permanently.

**The LLM's opinion is advisory.** With `ANTHROPIC_API_KEY` set, each new draft is
read by `REVIEW_MODEL` (`app/review.py`) after the upload response has already gone
out. It returns a structured `ok` / `flag` plus one sentence, stored on the entry as
a note for the reviewer. It never publishes or rejects anything: the archive is
about real people, and a classifier is not the right thing to have the last word on
whose name is remembered. It is prompted to flag slurs, attacks, spam, placeholder
names and empty transcriptions — and explicitly *not* to flag Hebrew or Arabic,
religious language, verses, units, nicknames, or a sticker's own words about how
somebody died. With no key the check is skipped and the draft simply waits.

## Seeding the wall

An empty archive on day one reads as abandoned. `app/seed.py` loads real entries
from a manifest and writes them in as already published:

```bash
make seed m=seed/entries.json     # or: uv run python -m app.seed seed/entries.json
```

The manifest is a JSON list of `{image, person_name, sticker_text}` plus optional
`latitude`/`longitude`, where `image` is a path relative to the manifest itself; see
`backend/seed/entries.example.json`. Re-running is safe — an entry whose normalized
name and image dimensions already match a row is skipped.

## Moderation and duplicates

**IP blacklist.** `POST /entries` and `POST /entries/{id}/feedback` refuse
blacklisted IPs with `403` and the stored reason. Reads stay open. Manage the list
through `/admin/blacklist` with either admin credential. With neither `ADMIN_TOKEN`
nor `ADMIN_USERNAME`/`ADMIN_PASSWORD` set, `/admin` is disabled entirely (`503`) and
nothing can be published; the backend logs a warning while `ADMIN_TOKEN` is still
the dev default `devtoken`.

**Duplicate detection.** Names are stored twice: as typed, and normalized
(NFKC-folded, lowercased, whitespace-collapsed) as the grouping key. Submitting an
entry returns `possible_duplicates` — exact normalized-name matches plus `pg_trgm`
near-matches above `NAME_SIMILARITY_THRESHOLD` — with `suggested_best_id` pointing
at the highest-resolution image, so the better photo is easy to spot.

**Resolution by vote.** `POST /entries/{id}/feedback` means "this image is the best
one for this person", one vote per IP per entry (a repeat is `409`). When an entry
reaches `DUPLICATE_VOTE_THRESHOLD` votes it wins, and its duplicates are **deleted
permanently** — row and image both, with no undo. Every deletion is logged with the
winner, loser, and vote count, which is the only remaining trace.

Deletion is deliberately limited to **exact** normalized-name matches. Fuzzy
`pg_trgm` hits are only ever shown to a person to judge: a 0.4-similarity match
between "Yoni Cohen" and "Yonatan Cohen" is worth surfacing and nowhere near
certain enough to justify destroying what may be a different person's entry.

**Client IP.** Both features identify people by IP, and browser traffic arrives via
a proxy, so the backend reads the leftmost `X-Forwarded-For` entry when
`TRUST_PROXY_HEADERS=true` (the Vite dev proxy sets it via `xfwd: true`). That
header is spoofable if the backend port is reachable directly — in production the
edge proxy must overwrite it and the backend port must not be published. IP
identity is also coarse: NAT shares one address between many people.

## Schema

`memorial_entries`: `id` (UUID PK), `status` (`pending`/`published`/`rejected`),
`person_name`, `person_name_normalized`, `sticker_text`, `latitude` (nullable),
`longitude` (nullable), `image_object_key`, `thumb_object_key` (nullable),
`image_width`/`image_height`/`image_bytes` (nullable), `submitter_ip` (nullable),
`review_note`/`reviewed_by`/`reviewed_at` (nullable), `llm_verdict`/`llm_reason`/
`llm_checked_at` (nullable), `created_at`, `updated_at`. Indexed on `created_at` and
`status`, plus btree and GIN trigram indexes on `person_name_normalized`.

`blacklisted_ips`: `ip` (PK), `reason`, `created_at`.

`image_feedback`: `id`, `entry_id` (FK, `ON DELETE CASCADE`), `voter_ip`,
`created_at`, unique on `(entry_id, voter_ip)`.

## Layout

```
backend/
  app/
    main.py         FastAPI app + CORS
    config.py       pydantic-settings, env-driven
    db.py           async engine, session dependency
    models.py       SQLAlchemy 2.x declarative models
    schemas.py      Pydantic v2 request/response models
    storage.py      MinIO client (upload/download/delete/probe/ensure bucket)
    names.py        person-name normalization (the duplicate grouping key)
    client_ip.py    X-Forwarded-For aware client IP
    blacklist.py    dependency that refuses blacklisted IPs on writes
    admin_auth.py   admin token + signed session token
    review.py       the LLM's advisory read on a submission
    seed.py         `python -m app.seed <manifest>` — publish real entries
    routers/entries.py
    routers/admin.py       sign-in and blacklist management
    routers/moderation.py  the review queue: publish, reject, delete
    init_infra.py   init-db sidecar entrypoint
  alembic/          migration env + versions
  seed/             seed manifests (see entries.example.json)
frontend/
  src/App.jsx       routes + layout shell
  src/i18n/         he/en dictionaries, RTL provider
  src/lib/          api client, formatting
  src/hooks/        reveal, paging, modal, draft flow, admin session + queue
  src/components/   wall grid, entry detail, upload steps, review queue
  src/pages/        Home, Wall, Contribute, About, Admin, NotFound
nginx/conf.d/         edge proxy config (production only)
docker-compose.yml        development
docker-compose.prod.yml   single-server deployment
```

## Common commands

```bash
make up        # docker compose up --build
make down      # stop
make reset     # stop and wipe database + object storage
make logs      # tail backend and frontend
make migration m="add a column"          # autogenerate a migration
make seed m=seed/entries.json            # publish entries from a manifest
make test      # backend test suite
make lint      # ruff + eslint + prettier + the frontend rule checks
make check     # everything CI checks
```

## Tests and CI

`CONTRIBUTING.md` has the detail. The short version:

```bash
cd backend  && uv run pytest    # unit tests always run
cd frontend && npm run check    # eslint, prettier, 300-line limit, he/en parity
```

The backend suite is in two tiers. Unit tests — name normalization, image
conversion, the best-image ranking — need nothing. Integration tests need a real
Postgres, because duplicate detection is `pg_trgm.similarity()` and the
vote-deletion path leans on `ON DELETE CASCADE`; they create their own database
at `TEST_DATABASE_URL` (default `…@localhost:5442/stickers_test`) and **skip**
when nothing is listening. A green run with 44 skips has not tested duplicate
matching — bring Postgres up with `docker compose up postgres`. CI sets
`REQUIRE_DATABASE=1`, which makes the skip a failure. MinIO is faked in-process.

`.github/workflows/docker-images.yml` runs ruff and pytest for the backend and
eslint, prettier and the frontend rule checks for the frontend, and only builds
the images if all of that passes.

## Deployment (single server)

`docker-compose.yml` is for development: the frontend is the Vite dev server and
every service publishes a host port. Production uses `docker-compose.prod.yml`,
where nginx is the only thing bound to the host and it proxies both halves of the
app:

```
        :80/:443            internal network
browser ─────────► nginx ─┬─ /      → frontend  (nginx serving the built SPA)
                          └─ /api/  → backend   (prefix stripped, uvicorn:8000)
                                       └─ postgres, minio
```

Stripping `/api` at the edge mirrors what the Vite proxy does in development, so
`src/lib/api.js` needs no build-time configuration.

### On the server

```bash
git clone https://github.com/ofryma/sticker-song && cd sticker-song
cp .env.prod.example .env      # fill in POSTGRES_PASSWORD and MINIO_SECRET_KEY
echo $GHCR_PAT | docker login ghcr.io -u <user> --password-stdin   # private packages
make prod-up                   # pull + up -d
make prod-logs
```

Deploying a new version is `make prod-up` again — with `IMAGE_TAG=main` that
pulls the newest build of the branch; pin it to a `v*` tag or a commit sha for
reproducible releases. `init-db` runs migrations and creates the bucket before
the API starts, exactly as in development.

TLS is not enabled by default. Put `fullchain.pem` and `privkey.pem` in
`nginx/certs/` and uncomment the two server blocks at the bottom of
`nginx/conf.d/default.conf`; the `certbot_webroot` volume is mounted at
`/var/www/certbot` for HTTP-01 renewals. Serving over HTTPS also restores the
browser geolocation permission, which plain HTTP on a public address blocks.

The MinIO console and the Postgres port are not published in production — reach
them over an SSH tunnel when you need them. `/api/docs` is proxied but FastAPI
generates absolute links for it, so use an SSH tunnel to `backend:8000` for the
interactive docs.

### Images

`.github/workflows/docker-images.yml` lints and tests both halves, then builds
both images on every push to `main` and every `v*` tag and pushes them to GHCR.
The image job depends on the check jobs, so a failing test publishes nothing:

| Image                                        | Dockerfile target        |
| -------------------------------------------- | ------------------------ |
| `ghcr.io/ofryma/sticker-song/backend`         | `backend/Dockerfile`     |
| `ghcr.io/ofryma/sticker-song/frontend`        | `frontend/Dockerfile` — `prod` (static build + nginx) |

Tags are `main`, `latest`, `sha-<commit>`, and semver for `v*` tags. Pull
requests build both images without pushing. `linux/amd64` only — add
`linux/arm64` to `platforms:` in the workflow for an ARM server.

The frontend Dockerfile has two targets from one dependency layer: `dev` (Vite
dev server, used by `docker-compose.yml`) and `prod` (`npm run build` into an
nginx image).

## Notes and next steps

The MVP deliberately omits contributor accounts, OCR, and maps. The
shape is ready for them: add a migration for new columns/tables, and add routers
under `backend/app/routers/`. Uploads are capped at 10 MB and must decode as an
image; the bucket is private, which is why images are proxied.

Geolocation in the browser requires a secure context — it works on
`http://localhost`, but exposing the frontend over plain HTTP on a LAN address
will block the "Use current location" button.

## Contributing

See `CONTRIBUTING.md`. Remembrance rather than mourning is the standard everything
is held to — copy, motion, colour, features, error messages.

## Licence

GNU Affero General Public License v3.0 — see `LICENSE`. Section 13 applies:
anyone running a modified version as a network service must offer its source to
the people using it.
