# Contributing

This is an archive of memorial stickers for fallen individuals, photographed
where they were found in public. It exists to remember these people in a good and
positive way — respectful and dignified, and deliberately not sad. That sets the
standard for everything in the repository: copy, motion, colour, features, error
messages, commit messages. The theme is light and warm rather than a night vigil,
features are about a life rather than a ritual of grief, and nothing gamifies or
rushes. See the Intent section of `README.md`, and
`.claude/rules/frontend.md` for the binding frontend version.

Read `README.md` first for the stack and the architecture. Read
`.claude/rules/frontend.md` before touching anything under `frontend/`.

## Getting set up

```bash
docker compose up --build     # or: make up
```

Everything has a working default, so no `.env` is needed. The frontend is on
<http://localhost:5173>, the API on <http://localhost:8000/docs>. `init-db` runs
the migrations and creates the bucket before the API starts; re-running it is
safe.

For running the tests and the linters you also want the tools on the host:

```bash
cd backend  && uv sync          # Python 3.12+, uv
cd frontend && npm install      # Node 20+
```

## Before you open a pull request

Both of these are what CI runs. If they pass locally, CI will pass.

```bash
# backend
cd backend
uv run ruff check .
uv run ruff format --check .
uv run pytest

# frontend
cd frontend
npm run check          # eslint + prettier + the repo-specific rules
npm run build
```

`npm run lint:fix` and `npm run format` fix what is mechanically fixable, as do
`uv run ruff check --fix .` and `uv run ruff format .`.

## Tests

```bash
uv run pytest                       # everything that can run
uv run pytest -m integration        # only the tests that need Postgres
uv run pytest tests/test_names.py   # one file
```

The suite comes in two tiers.

**Unit tests** — `test_names.py`, `test_images.py`, `test_suggest_best.py` — need
nothing but the package and always run.

**Integration tests** need a real Postgres, because duplicate detection is built
on `pg_trgm.similarity()` and the vote-deletion path relies on
`ON DELETE CASCADE`. Neither is worth faking. They point at
`TEST_DATABASE_URL`, defaulting to the port `docker compose` publishes:

```
postgresql+asyncpg://postgres:postgres@localhost:5442/stickers_test
```

They create that database and install `pg_trgm` themselves, and they **skip**
rather than fail when nothing is listening, so `pytest` stays useful on a laptop
with no stack running. Watch for the `s` characters in the output — a green run
with 44 skips has not tested duplicate matching. Bring Postgres up with
`docker compose up postgres` to run them for real. CI sets `REQUIRE_DATABASE=1`,
which turns that skip into a failure.

MinIO is faked in-process (`FakeStorage` in `tests/conftest.py`) — the tests
assert on which objects were written and deleted, so no bucket is needed.

### What deserves a test

Anything touching the parts that are hard to undo or easy to get subtly wrong:

- **`app/names.py`** — the normalized name is the duplicate grouping key, and the
  vote path deletes on an exact match of it. A change here changes what gets
  destroyed.
- **`app/images.py`** — every upload is re-encoded through it. EXIF orientation
  must be applied and all metadata, GPS included, must be dropped.
- **duplicate matching** — specifically the exact/fuzzy split. Only exact
  normalized-name matches are ever deleted automatically.
- **the vote-deletion path** — the one irreversible operation in the app.
- **the blacklist** — the only moderation tool there is.

## Backend conventions

- FastAPI, SQLAlchemy 2.x async, Pydantic v2. Routers under
  `app/routers/`, one module per resource.
- Configuration is env-driven through `app/config.py`. Never read `os.environ`
  in a route; add a field to `Settings`.
- Blocking work — Pillow, MinIO — goes through `run_in_threadpool`.
- Schema changes need an Alembic migration:
  `make migration m="add moderation flag"`. Write the downgrade too.
- Dependencies are locked. After editing `pyproject.toml`, run `uv lock` and
  commit `uv.lock`. The Dockerfile installs with `--frozen`, which installs the
  lock verbatim without re-resolving — so a dependency you added but did not lock
  is silently missing from the image rather than a build error. CI runs
  `uv sync --locked`, which fails on a stale lock, and that is what catches it.

## Frontend conventions

`.claude/rules/frontend.md` is the full text and it is binding. The short
version:

- **No file over 300 lines.** `npm run check:rules` enforces it.
- **HeroUI first**, every button through `src/components/ui/Action.jsx`, theming
  in `hero.js`.
- **Tailwind v4 for layout.** Design tokens live in `src/tokens.css` under
  `@theme` — never hardcode a hex value, a duration or an easing.
- **No new runtime dependencies without asking.**
- **Remembrance, not mourning.** Daylight surfaces (`day-*`), ink text, olive/sun/
  tekhelet accents; photographs shown whole and in colour; the remembering gesture
  is a leaf, not a candle. No dark surface anywhere.
- **Unhurried, gentle motion.** 700ms–2500ms, `ease-out` or `ease-calm`.
  Nothing bounces, springs, pops or overshoots. Everything degrades under
  `prefers-reduced-motion`.
- **Copy is plain and warm, never gamified.** No exclamation marks, no emoji, no
  counts framed as achievements. A submission is acknowledged with thanks.
- **Bilingual.** Every user-facing string goes in `src/i18n/he.js` *and*
  `src/i18n/en.js` — `npm run check:rules` fails if the two drift apart. Hebrew
  is the default and the document direction flips, so use logical properties
  (`ps-*`, `pe-*`, `ms-*`, `me-*`, `text-start`) and never `pl-*`/`left-*` for
  content flow.
- **Accessible.** Keyboard reachable, visible focus rings, labelled inputs, `alt`
  on every image, modals trap focus and close on Escape.

`eslint.config.js` carries a few rules as warnings rather than errors where they
flag pre-existing code; `todo.md` tracks those. Do not add new warnings.

## Commits and pull requests

- Small, focused commits with a plain imperative subject: `strip GPS from HEIC
  uploads`, not `fixes`.
- Say what changed and why in the pull request body. If it changes anything a
  visitor sees, say how it looks and reads in both languages.
- A pull request that changes backend behaviour should come with the test that
  would have caught the bug.

## Reporting a problem with an entry

If an entry is wrongly attributed, abusive, or should be taken down at the
family's request, that is not a bug report — open an issue marked private or
contact the maintainer directly. Do not attach the material to a public issue.

Security issues: same, privately, not in a public issue.

## Licence

The project is licensed under the GNU Affero General Public License v3.0 — see
`LICENSE`. By contributing you agree your contribution is licensed under the
same terms.

AGPL section 13 matters here: anyone running a modified version of this as a
network service has to offer its source to the people using it.
