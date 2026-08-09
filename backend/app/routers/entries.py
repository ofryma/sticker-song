import logging
import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import delete, func, or_, select, true
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import db, images, review, storage
from app.blacklist import AllowedIpDep
from app.client_ip import ClientIpDep
from app.config import settings
from app.db import SessionDep
from app.models import ImageFeedback, MemorialEntry
from app.names import normalize_person_name, tidy_person_name
from app.schemas import (
    DuplicateCandidate,
    DuplicateListResponse,
    EntryCreateResponse,
    FeedbackResponse,
    MemorialEntryRead,
    NameMatchResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/entries", tags=["entries"])

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_CANDIDATES = 20


async def _get_entry_or_404(session: AsyncSession, entry_id: uuid.UUID) -> MemorialEntry:
    entry = await session.get(MemorialEntry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


async def _get_visible_or_404(
    session: AsyncSession, entry_id: uuid.UUID, client_ip: str
) -> MemorialEntry:
    """A published entry, or an unpublished one the caller submitted themselves.

    A draft is not public, but the person who just uploaded it is shown their own
    submission on the thank-you screen, so their own IP may still read it. Everyone
    else gets the same 404 as a missing entry — a draft's existence is not public
    information either.
    """
    entry = await _get_entry_or_404(session, entry_id)
    if entry.status != "published" and entry.submitter_ip != client_ip:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")
    return entry


async def _run_llm_review(entry_id: uuid.UUID, person_name: str, text: str) -> None:
    """Ask the model about a fresh draft, in the background, on its own session.

    The upload response must not wait on an LLM round trip, and a failure here is
    only a missing note on the draft — the reviewer still sees the entry. Nothing
    is allowed to escape: this runs after the response has already been sent, so an
    exception here would surface as a phantom error with no request to attach to.

    `db.SessionFactory` is looked up at call time rather than imported, so a test
    can point it at the test database.
    """
    try:
        analysis = await review.analyze(person_name, text)
        if analysis is None:
            return
        async with db.SessionFactory() as session:
            entry = await session.get(MemorialEntry, entry_id)
            if entry is None:  # deleted or rejected while we were thinking
                return
            entry.llm_verdict = analysis.verdict
            entry.llm_reason = analysis.reason
            entry.llm_checked_at = datetime.now(UTC)
            await session.commit()
        logger.info("llm review %s: %s", entry_id, analysis.verdict)
    except Exception as exc:  # noqa: BLE001 - background work, already responded
        logger.warning(
            "llm review of %s failed: %s: %s", entry_id, type(exc).__name__, exc
        )


def _pixels(entry: MemorialEntryRead | MemorialEntry) -> int:
    return (entry.image_width or 0) * (entry.image_height or 0)


async def _count_votes(session: AsyncSession, entry_id: uuid.UUID) -> int:
    return (
        await session.scalar(
            select(func.count(ImageFeedback.id)).where(ImageFeedback.entry_id == entry_id)
        )
        or 0
    )


async def candidates_for_name(
    session: AsyncSession,
    normalized: str,
    exclude_id: uuid.UUID | None = None,
) -> list[DuplicateCandidate]:
    """Published entries whose name plausibly means the same person.

    Exact normalized-name matches plus pg_trgm near-matches. The exact flag is
    what the resolution step keys off; fuzzy hits are shown to humans only.
    Drafts are excluded: a contributor comparing photographs must not be shown
    somebody else's unreviewed submission.

    Keyed on the name alone rather than on a row, so the same matching answers
    both callers: an entry that already exists, and a name a visitor is still
    typing into the wizard.
    """
    vote_count = (
        select(func.count(ImageFeedback.id))
        .where(ImageFeedback.entry_id == MemorialEntry.id)
        .scalar_subquery()
    )
    is_exact = MemorialEntry.person_name_normalized == normalized
    similarity = func.similarity(MemorialEntry.person_name_normalized, normalized)

    rows = await session.execute(
        select(MemorialEntry, vote_count, is_exact)
        .where(MemorialEntry.id != exclude_id if exclude_id else true())
        .where(MemorialEntry.status == "published")
        .where(or_(is_exact, similarity > settings.name_similarity_threshold))
        .order_by(is_exact.desc(), similarity.desc(), MemorialEntry.created_at.desc())
        .limit(MAX_CANDIDATES)
    )

    candidates: list[DuplicateCandidate] = []
    for candidate, votes, exact in rows:
        base = MemorialEntryRead.model_validate(candidate).model_dump(
            exclude={"image_url"}
        )
        candidates.append(
            DuplicateCandidate(**base, vote_count=votes, is_exact_match=exact)
        )
    return candidates


async def find_duplicate_candidates(
    session: AsyncSession, entry: MemorialEntry
) -> list[DuplicateCandidate]:
    """Everything but `entry` itself that may describe the same person."""
    return await candidates_for_name(
        session, entry.person_name_normalized, exclude_id=entry.id
    )


def _suggest_best(
    entry: MemorialEntryRead, candidates: list[DuplicateCandidate]
) -> uuid.UUID:
    """Highest-resolution image, votes breaking ties."""
    best_id = entry.id
    best_key = (_pixels(entry), 0)
    for candidate in candidates:
        key = (_pixels(candidate), candidate.vote_count)
        if key > best_key:
            best_id, best_key = candidate.id, key
    return best_id


async def read_upload(image: UploadFile) -> bytes:
    """The bytes of an uploaded photograph, refused if empty or oversized."""
    data = await image.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded image is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image larger than 10 MB"
        )
    return data


async def store_image(data: bytes) -> tuple[str, str | None, images.NormalizedImage]:
    """Re-encode a photograph and put it in the bucket, thumbnail and all.

    Shared by a visitor's submission and by a reviewer replacing the photograph
    on an entry, so both end up with the same canonical bytes, the same stripped
    metadata, and the same pair of objects.
    """
    # The declared content type is only a hint; the format comes from the bytes,
    # and everything is stored re-encoded in one canonical format.
    try:
        normalized = await images.normalize_async(data)
    except images.UnsupportedImage as exc:
        logger.info("rejected upload: %s", exc)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Uploaded file must be an image"
        ) from exc

    object_key = storage.build_object_key(normalized.extension)
    await run_in_threadpool(
        storage.upload_image, object_key, normalized.data, normalized.content_type
    )

    # A thumbnail so the wall grid and the collage never download the full upload.
    # Built from the already-normalized bytes, and non-fatal: without it the image
    # endpoint serves the full-size object instead.
    thumb_key: str | None = storage.build_thumb_key(object_key)
    try:
        thumb = await images.make_thumbnail_async(normalized.data)
        await run_in_threadpool(
            storage.upload_image, thumb_key, thumb.data, thumb.content_type
        )
    except (images.UnsupportedImage, OSError) as exc:
        logger.warning("thumbnail failed for %s: %s", object_key, exc)
        thumb_key = None

    logger.info(
        "stored image %s: %s -> %s (%d -> %d bytes)",
        object_key,
        normalized.source_format,
        normalized.content_type,
        len(data),
        len(normalized.data),
    )
    return object_key, thumb_key, normalized


@router.post("", response_model=EntryCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    session: SessionDep,
    client_ip: AllowedIpDep,
    background: BackgroundTasks,
    image: Annotated[UploadFile, File(description="Photo of the sticker")],
    person_name: Annotated[str, Form(min_length=1, max_length=255)],
    sticker_text: Annotated[str, Form(min_length=1)],
    latitude: Annotated[float | None, Form(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Form(ge=-180, le=180)] = None,
) -> EntryCreateResponse:
    data = await read_upload(image)
    object_key, thumb_key, normalized = await store_image(data)

    entry = MemorialEntry(
        # Held as a draft: nothing reaches the wall without a person publishing it,
        # so an offensive or incomplete submission is never public even briefly.
        status="pending" if settings.require_review else "published",
        person_name=tidy_person_name(person_name),
        person_name_normalized=normalize_person_name(person_name),
        sticker_text=sticker_text.strip(),
        latitude=latitude,
        longitude=longitude,
        image_object_key=object_key,
        thumb_object_key=thumb_key,
        image_width=normalized.width,
        image_height=normalized.height,
        image_bytes=len(normalized.data),
        submitter_ip=client_ip,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)

    # The reviewer's head start, fetched after the response goes out.
    background.add_task(_run_llm_review, entry.id, entry.person_name, entry.sticker_text)

    candidates = await find_duplicate_candidates(session, entry)
    created = MemorialEntryRead.model_validate(entry)
    return EntryCreateResponse(
        entry=created,
        possible_duplicates=candidates,
        suggested_best_id=_suggest_best(created, candidates),
        awaiting_review=entry.status == "pending",
    )


@router.get("", response_model=list[MemorialEntryRead])
async def list_entries(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MemorialEntry]:
    """The wall: published entries only, newest first."""
    result = await session.scalars(
        select(MemorialEntry)
        .where(MemorialEntry.status == "published")
        .order_by(MemorialEntry.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result)


@router.get("/matches", response_model=NameMatchResponse)
async def find_name_matches(
    session: SessionDep,
    name: Annotated[str, Query(min_length=1, max_length=255)],
) -> NameMatchResponse:
    """Who the archive already remembers under this name.

    Asked from the name step of the wizard, before anything is uploaded, so a
    person can keep the sticker that is already here instead of adding a second
    one. Published entries only, exactly as after a save — a draft awaiting a
    reviewer is nobody else's business.

    Declared above `/{entry_id}` so the literal path wins the match.
    """
    normalized = normalize_person_name(name)
    matches = await candidates_for_name(session, normalized) if normalized else []
    return NameMatchResponse(
        person_name=tidy_person_name(name),
        matches=matches,
        has_exact_match=any(match.is_exact_match for match in matches),
    )


@router.get("/{entry_id}", response_model=MemorialEntryRead)
async def get_entry(
    session: SessionDep, client_ip: ClientIpDep, entry_id: uuid.UUID
) -> MemorialEntry:
    return await _get_visible_or_404(session, entry_id, client_ip)


@router.get("/{entry_id}/duplicates", response_model=DuplicateListResponse)
async def list_duplicates(
    session: SessionDep, client_ip: ClientIpDep, entry_id: uuid.UUID
) -> DuplicateListResponse:
    entry = await _get_visible_or_404(session, entry_id, client_ip)
    candidates = await find_duplicate_candidates(session, entry)
    read = MemorialEntryRead.model_validate(entry)
    return DuplicateListResponse(
        entry=read,
        possible_duplicates=candidates,
        suggested_best_id=_suggest_best(read, candidates),
    )


@router.post("/{entry_id}/feedback", response_model=FeedbackResponse)
async def submit_feedback(
    session: SessionDep, client_ip: AllowedIpDep, entry_id: uuid.UUID
) -> FeedbackResponse:
    """Vote that this image is the best one for its person.

    Once a vote count reaches the threshold, every *exact* normalized-name
    duplicate is deleted permanently, image included.
    """
    entry = await _get_entry_or_404(session, entry_id)
    if entry.status != "published":
        raise HTTPException(status.HTTP_409_CONFLICT, "This entry is not published yet")

    session.add(ImageFeedback(entry_id=entry.id, voter_ip=client_ip))
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, "You have already voted for this image"
        ) from None

    votes = await _count_votes(session, entry.id)
    deleted: list[uuid.UUID] = []
    if votes >= settings.duplicate_vote_threshold:
        deleted = await _resolve_duplicates(session, entry, votes)

    return FeedbackResponse(
        entry_id=entry.id,
        vote_count=votes,
        threshold=settings.duplicate_vote_threshold,
        resolved=bool(deleted),
        deleted_entry_ids=deleted,
    )


async def _resolve_duplicates(
    session: AsyncSession, winner: MemorialEntry, votes: int
) -> list[uuid.UUID]:
    """Delete the winner's exact-name duplicates, rows and images alike.

    Scoped to exact normalized-name matches on purpose: a fuzzy pg_trgm hit is
    good enough to suggest to a person but nowhere near good enough to justify
    irreversibly destroying what might be a different person's entry.
    """
    losers = list(
        await session.scalars(
            select(MemorialEntry)
            .where(
                MemorialEntry.person_name_normalized == winner.person_name_normalized,
                MemorialEntry.id != winner.id,
                # Drafts never lose a vote they were not part of.
                MemorialEntry.status == "published",
            )
            .with_for_update()
        )
    )
    if not losers:
        return []

    deleted: list[uuid.UUID] = []
    for loser in losers:
        # Object first: a crash then leaves an orphaned object rather than a row
        # pointing at nothing.
        await delete_entry_objects(loser)
        logger.info(
            "duplicate resolved: winner=%s votes=%d deleted=%s object=%s",
            winner.id,
            votes,
            loser.id,
            loser.image_object_key,
        )
        deleted.append(loser.id)

    # Core DELETE so Postgres cascades the feedback rows.
    await session.execute(delete(MemorialEntry).where(MemorialEntry.id.in_(deleted)))
    await session.commit()
    return deleted


async def delete_entry_objects(entry: MemorialEntry) -> None:
    """Remove an entry's image and its thumbnail. Missing objects are not errors."""
    await run_in_threadpool(storage.delete_image, entry.image_object_key)
    if entry.thumb_object_key:
        await run_in_threadpool(storage.delete_image, entry.thumb_object_key)


async def serve_object(object_key: str) -> Response:
    """One object out of the bucket, cached hard.

    Keys are content-addressed and an entry's bytes never change under the same
    URL, so the browser can keep it indefinitely — which is what stops every wall
    scroll from re-hitting the API and MinIO.
    """
    data, content_type = await run_in_threadpool(storage.download_image, object_key)
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Cache-Control": f"public, max-age={settings.image_cache_seconds}, immutable"
        },
    )


@router.get("/{entry_id}/image")
async def get_entry_image(
    session: SessionDep, client_ip: ClientIpDep, entry_id: uuid.UUID
) -> Response:
    entry = await _get_visible_or_404(session, entry_id, client_ip)
    return await serve_object(entry.image_object_key)


@router.get("/{entry_id}/thumb")
async def get_entry_thumb(
    session: SessionDep, client_ip: ClientIpDep, entry_id: uuid.UUID
) -> Response:
    """The small copy. Entries written before thumbnails existed fall back to the
    full image, so this path is always safe to request."""
    entry = await _get_visible_or_404(session, entry_id, client_ip)
    return await serve_object(entry.thumb_object_key or entry.image_object_key)
