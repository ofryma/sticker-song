"""An LLM read on what a contributor typed, for the reviewer's benefit.

Every submission is held as a draft and published by a person. This module gives
that person a head start: it reads the name and the transcribed sticker text and
says whether anything looks offensive, incomplete, or unlike a memorial sticker.

It is deliberately **advisory**. Nothing here publishes or rejects an entry — a
verdict is a note attached to the draft, and a human still decides. The archive is
about real people, and a classifier is not the right thing to have the last word
on whose name is remembered.

With no ``ANTHROPIC_API_KEY`` the check is skipped and the draft simply waits.
"""

import logging
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You help review submissions to an archive of memorial stickers for fallen \
individuals, photographed in public space. A contributor uploads a photo of a \
sticker and transcribes two things: the person's name, and the text printed on \
the sticker.

Your job is to tell a human reviewer whether this submission looks ready to \
publish. Judge only the two text fields you are given.

Flag a submission when any of these hold:
- The text is offensive: a slur, an attack on the person or on a group, mockery, \
  a threat, or a call for violence.
- The name is not a plausible person's name: a placeholder, a test string, \
  keyboard mash, a public figure being made fun of, or an obvious joke.
- The submission is spam or advertising, or contains a phone number, an email \
  address, a URL, or a handle used to promote something.
- The text is too incomplete to be a record: empty of meaning, a single \
  character, or unrelated to the name.

Do not flag a submission for any of these:
- Hebrew, Arabic, English, or a mix of them, including transliteration.
- Religious language, verses, prayers, dates, ages, military unit names, \
  nicknames, or terms of endearment. Sticker text often carries all of these.
- Grief, loss, or how someone died, when the sticker itself says it. Those are \
  the words somebody chose, and transcribing them faithfully is the point.
- Spelling mistakes, missing punctuation, or rough transcription.
- Being short. A sticker often carries only a name and a date.

Be conservative: an entry you are unsure about is "ok", because a person will \
read it anyway. Write the reason for the reviewer in one plain sentence, in \
English, and name the specific problem rather than restating the rule.\
"""


class ReviewOpinion(BaseModel):
    """The structured verdict the model is constrained to return."""

    verdict: Literal["ok", "flag"] = Field(
        description="'flag' if a human should look closely before publishing."
    )
    reason: str = Field(
        description="One sentence for the reviewer, in English. Why it was flagged, "
        "or what the submission appears to be if it looks fine."
    )


@dataclass(frozen=True)
class Analysis:
    """What gets written onto the draft."""

    verdict: str  # "ok" | "flag" | "error"
    reason: str


def _prompt(person_name: str, sticker_text: str) -> str:
    return (
        "Review this submission.\n\n"
        f"<person_name>\n{person_name}\n</person_name>\n\n"
        f"<sticker_text>\n{sticker_text}\n</sticker_text>"
    )


async def analyze(person_name: str, sticker_text: str) -> Analysis | None:
    """The model's opinion, or None when no API key is configured.

    Never raises: a failure here must not cost a contributor their submission, so
    an error is recorded as a verdict of its own and the draft still waits for a
    human.
    """
    if not settings.review_enabled:
        return None

    try:
        from anthropic import AsyncAnthropic

        client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        response = await client.messages.parse(
            model=settings.review_model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": _prompt(person_name, sticker_text)}],
            output_format=ReviewOpinion,
        )
        opinion = response.parsed_output
        if opinion is None:
            # A refusal or a truncated response: no verdict to record.
            raise ValueError(f"no parsed output (stop_reason={response.stop_reason})")
    except Exception as exc:  # noqa: BLE001 - advisory step; never fail the upload
        logger.warning("llm review failed: %s: %s", type(exc).__name__, exc)
        return Analysis(verdict="error", reason=f"{type(exc).__name__}: {exc}"[:500])

    return Analysis(verdict=opinion.verdict, reason=opinion.reason.strip()[:500])
