# Todo

## Blockers — do not deploy without these

* **Postgres and MinIO backups.** Duplicate resolution deletes rows and images
  permanently with no undo; there is currently no backup at all. Automated dump
  + volume snapshot, offsite, and a tested restore.
* **Reconsider `DUPLICATE_VOTE_THRESHOLD=3`.** Three IPs can permanently destroy
  any entry, and at launch traffic that is trivial to reach. Either raise it,
  gate deletion behind an admin action, or switch to soft delete with a
  retention window. (ofry's comment - definitly, should be at least 20)
* **Rate limiting on `POST /entries` and `/feedback`.** Both are unauthenticated
  and public; the IP blacklist is only reactive. Add limits at the nginx edge
  (`limit_req_zone`) at least.
* **Set `ADMIN_USERNAME`, `ADMIN_PASSWORD` and a strong `ADMIN_TOKEN`.**
  `.env.prod.example` ships them empty, which disables `/admin` — and with it the
  review queue, so nothing submitted can ever be published.
* **Write the launch seed manifest.** `make seed m=seed/entries.json` exists and
  `backend/seed/entries.example.json` shows the shape; the real photographs,
  names and transcriptions still have to be collected and checked.
* **Someone on the review queue at launch.** Submissions now wait at `/admin`
  rather than publishing themselves, so an unattended queue means contributors
  see nothing appear. Decide who watches it and how often.
* **TLS.** The HTTPS server blocks in `nginx/conf.d/default.conf` are commented
  out. Needed for the browser geolocation permission too. Issue certs, uncomment,
  add HTTP→HTTPS redirect and automated certbot renewal.
* **Pin `IMAGE_TAG`.** Prod defaults to `main`; tag a `v*` release and pin it so
  a deploy is reproducible and rollback is a one-line change.

## Infrastructure

* Provision the server: domain + DNS, firewall open on 80/443 only, SSH
  hardened, Docker enabled on boot so the stack survives a reboot
* Confirm the server architecture — the workflow builds `linux/amd64` only; add
  `linux/arm64` if it is an ARM box
* GHCR packages are private, so the server needs a PAT. Use a read-only
  `read:packages` token and note its rotation
* `docker-compose.prod.yml`: no healthchecks on `backend`/`frontend`/`nginx`, and
  `nginx` uses a bare `depends_on`. Add them so a broken deploy fails visibly
* Log rotation — the default json-file driver grows unbounded. Set
  `logging.options.max-size`/`max-file` per service
* Memory/CPU limits, and tune Postgres beyond the image defaults
* `PUBLIC_ORIGIN` / `CORS_ORIGINS` take a single origin — decide apex vs `www`
  and redirect the other at nginx
* Rotate `MINIO_SECRET_KEY`, `POSTGRES_PASSWORD` and the admin password off any
  value used in dev
* Decide whether to set `ANTHROPIC_API_KEY` in production. Without it drafts get
  no LLM note and wait for a human as usual; with it, submitted names and sticker
  text are sent to the Anthropic API — worth saying so in the privacy notice
* Verify a cold start on a clean volume: `alembic upgrade head` including the
  `pg_trgm` extension under the prod `POSTGRES_USER`, and bucket creation
* Write a deploy runbook: smoke test after `make prod-up`, rollback by tag, and
  the migration downgrade path (never tested)

## Observability

* Uptime check against `/healthz` with alerting — it exists and nothing calls it (ofry's comment - lets add uptime kuma)
* Error tracking on both halves (Sentry or equivalent); a backend 500 is
  currently only visible in `docker logs`
* Structured request logging with the real client IP, and decide a retention
  period for it

## Security and privacy

* `submitter_ip` is stored indefinitely. Document why, and set a retention or
  anonymization policy
* Privacy notice and terms: what is collected, that EXIF/GPS is stripped from
  every upload, how to request a takedown, and a contact address
* Add HSTS once TLS is live, and a Content-Security-Policy
* Google Fonts is loaded from a third party, which leaks visitor IPs and
  complicates CSP. Self-host Assistant / David Libre / Suez One
* `TRUST_PROXY_HEADERS=true` is only safe because the backend port is
  unpublished — verify that holds on the server, since `X-Forwarded-For` drives
  both blacklisting and vote identity

## Performance

* The image handlers read the whole object into memory before responding despite
  the README calling it a stream — stream it, or cache at nginx. They do now send
  long-lived immutable `Cache-Control`, so a wall scroll no longer re-hits MinIO
* `GET /entries` has no cursor pagination and the wall pages by offset; fine at
  launch scale, revisit if the archive grows

## Launch polish

* Open Graph and Twitter card meta plus a share image — this will be shared in
  WhatsApp and Telegram, where an unfurl with no image looks careless
* `robots.txt` and a sitemap
* React error boundary; a render crash currently gives a blank page
* Accessibility pass on the real build: focus rings, alt text, modal focus trap,
  `prefers-reduced-motion`
* Test on real iOS and Android Safari/Chrome — HEIC upload, the camera picker,
  geolocation over HTTPS, and RTL layout
* Add link to the github project for project contribution
