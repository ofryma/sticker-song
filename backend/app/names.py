import re
import unicodedata

_WHITESPACE = re.compile(r"\s+")


def tidy_person_name(name: str) -> str:
    """Display form: trimmed with internal whitespace runs collapsed, case kept."""
    return _WHITESPACE.sub(" ", name).strip()


def normalize_person_name(name: str) -> str:
    """Grouping key for a person's name.

    NFKC folding matters for Hebrew: the same name can arrive with different
    combining marks or presentation forms, which would otherwise defeat exact
    grouping. Must stay in sync with the backfill in migration 0002.
    """
    folded = unicodedata.normalize("NFKC", name)
    return _WHITESPACE.sub(" ", folded).strip().lower()
