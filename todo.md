# Todo

## Features

* Analyze input from user with llm
* Add draft step for entries to make sure every new entry is being reviewd before being uploaded
  That way we never upload something offensive or incomplete.
* Seed the wall with real entries before launch — an empty archive on day one
  reads as abandoned
* Not-found route currently renders `Home` silently (`App.jsx`); give it a real
  page or a redirect
* Thumbnails for the wall grid — it loads full-size webp per tile, which is a
  heavy mobile payload

## Project

* AGPL section 13 obliges a network service to offer its source to its users.
  Add a "Source" link in the footer pointing at the repository
* Three `react-hooks` v7 rules are warnings in `eslint.config.js` because they
  flag pre-existing code. Fix and promote each back to `error`:
  * `useCollageCycle.js` — `setState` called synchronously in two effects
    (slot-count reset, and the media-query listener)
  * `useStickerDraft.js` — `previewUrl.current` read during render
* No frontend tests. The rule checks and eslint cover structure, nothing covers
  behaviour — the draft flow and duplicate review are the parts worth testing
* Backend integration tests fake MinIO in-process. Nothing exercises the real
  client, so a `storage.py` regression would ship green

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
* **Set a strong `ADMIN_TOKEN`.** `.env.prod.example` ships it empty, which
  disables `/admin` — including the blacklist, the only moderation tool.
* **Admin takedown endpoint.** Admin can blacklist IPs but cannot delete or hide
  an entry. There must be a way to remove abusive or wrongly-attributed content.
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
* Rotate `MINIO_SECRET_KEY` and `POSTGRES_PASSWORD` off any value used in dev
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
* Decide moderation posture: entries publish instantly with no review. At
  minimum have someone watching the wall on launch day

## Performance

* `GET /entries/{id}/image` sets no `Cache-Control`, so every wall scroll re-hits
  the API and MinIO. Add long-lived immutable caching (keys are content-addressed)
* That handler also reads the whole object into memory before responding despite
  the README calling it a stream — stream it, or cache at nginx
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
