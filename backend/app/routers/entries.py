import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import images, storage
from app.blacklist import AllowedIpDep
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


def _pixels(entry: MemorialEntryRead | MemorialEntry) -> int:
    return (entry.image_width or 0) * (entry.image_height or 0)


async def _count_votes(session: AsyncSession, entry_id: uuid.UUID) -> int:
    return (
        await session.scalar(
            select(func.count(ImageFeedback.id)).where(ImageFeedback.entry_id == entry_id)
        )
        or 0
    )


async def find_duplicate_candidates(
    session: AsyncSession, entry: MemorialEntry
) -> list[DuplicateCandidate]:
    """Other entries that plausibly describe the same person.

    Exact normalized-name matches plus pg_trgm near-matches. The exact flag is
    what the resolution step keys off; fuzzy hits are shown to humans only.
    """
    normalized = entry.person_name_normalized
    vote_count = (
        select(func.count(ImageFeedback.id))
        .where(ImageFeedback.entry_id == MemorialEntry.id)
        .scalar_subquery()
    )
    is_exact = MemorialEntry.person_name_normalized == normalized
    similarity = func.similarity(MemorialEntry.person_name_normalized, normalized)

    rows = await session.execute(
        select(MemorialEntry, vote_count, is_exact)
        .where(MemorialEntry.id != entry.id)
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


@router.post("", response_model=EntryCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_entry(
    session: SessionDep,
    client_ip: AllowedIpDep,
    image: Annotated[UploadFile, File(description="Photo of the sticker")],
    person_name: Annotated[str, Form(min_length=1, max_length=255)],
    sticker_text: Annotated[str, Form(min_length=1)],
    latitude: Annotated[float | None, Form(ge=-90, le=90)] = None,
    longitude: Annotated[float | None, Form(ge=-180, le=180)] = None,
) -> EntryCreateResponse:
    data = await image.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded image is empty")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image larger than 10 MB"
        )

    # The declared content type is only a hint; the format comes from the bytes,
    # and everything is stored re-encoded in one canonical format.
    try:
        normalized = await run_in_threadpool(images.normalize, data)
    except images.UnsupportedImage as exc:
        logger.info("rejected upload: declared=%s error=%s", image.content_type, exc)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Uploaded file must be an image"
        ) from exc

    object_key = storage.build_object_key(normalized.extension)
    await run_in_threadpool(
        storage.upload_image, object_key, normalized.data, normalized.content_type
    )
    logger.info(
        "stored image %s: %s -> %s (%d -> %d bytes)",
        object_key,
        normalized.source_format,
        normalized.content_type,
        len(data),
        len(normalized.data),
    )

    entry = MemorialEntry(
        person_name=tidy_person_name(person_name),
        person_name_normalized=normalize_person_name(person_name),
        sticker_text=sticker_text.strip(),
        latitude=latitude,
        longitude=longitude,
        image_object_key=object_key,
        image_width=normalized.width,
        image_height=normalized.height,
        image_bytes=len(normalized.data),
        submitter_ip=client_ip,
    )
    session.add(entry)
    await session.commit()
    await session.refresh(entry)

    candidates = await find_duplicate_candidates(session, entry)
    created = MemorialEntryRead.model_validate(entry)
    return EntryCreateResponse(
        entry=created,
        possible_duplicates=candidates,
        suggested_best_id=_suggest_best(created, candidates),
    )


@router.get("", response_model=list[MemorialEntryRead])
async def list_entries(
    session: SessionDep,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[MemorialEntry]:
    result = await session.scalars(
        select(MemorialEntry)
        .order_by(MemorialEntry.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result)


@router.get("/{entry_id}", response_model=MemorialEntryRead)
async def get_entry(session: SessionDep, entry_id: uuid.UUID) -> MemorialEntry:
    return await _get_entry_or_404(session, entry_id)


@router.get("/{entry_id}/duplicates", response_model=DuplicateListResponse)
async def list_duplicates(
    session: SessionDep, entry_id: uuid.UUID
) -> DuplicateListResponse:
    entry = await _get_entry_or_404(session, entry_id)
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
        await run_in_threadpool(storage.delete_image, loser.image_object_key)
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


@router.get("/{entry_id}/image")
async def get_entry_image(session: SessionDep, entry_id: uuid.UUID) -> Response:
    entry = await _get_entry_or_404(session, entry_id)
    data, content_type = await run_in_threadpool(
        storage.download_image, entry.image_object_key
    )
    return Response(content=data, media_type=content_type)
