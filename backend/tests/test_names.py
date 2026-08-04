"""Name normalization — the duplicate grouping key.

`normalize_person_name` decides whether two submissions are the same person, and
the vote-deletion path deletes on an exact match of its output. A change here
silently changes what gets destroyed, so the cases are spelled out.
"""

import pytest

from app.names import normalize_person_name, tidy_person_name


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Full Name", "Full Name"),
        ("  Full Name  ", "Full Name"),
        ("Full    Name", "Full Name"),
        ("Full\tName", "Full Name"),
        ("Full\n\nName", "Full Name"),
        ("MiXeD CaSe", "MiXeD CaSe"),
        ("", ""),
        ("   ", ""),
    ],
)
def test_tidy_collapses_whitespace_and_keeps_case(raw: str, expected: str) -> None:
    assert tidy_person_name(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Full Name", "full name"),
        ("  FULL   NAME ", "full name"),
        ("Full\tName", "full name"),
        ("", ""),
    ],
)
def test_normalize_folds_case_and_whitespace(raw: str, expected: str) -> None:
    assert normalize_person_name(raw) == expected


def test_normalize_is_idempotent() -> None:
    once = normalize_person_name("  Some   Name  ")
    assert normalize_person_name(once) == once


@pytest.mark.parametrize(
    ("left", "right"),
    [
        # NFKC folds a decomposed Hebrew letter+dagesh onto its precomposed form.
        ("שלום", "שלום"),
        ("שׁלום", "שׁלום"),
        # Presentation-form Hebrew ligature vs. its plain letters.
        ("ﭏ", "אל"),
        # Non-breaking space is a space once folded.
        ("Full Name", "Full Name"),
        # Fullwidth Latin folds to ASCII.
        ("Ｆｕｌｌ", "Full"),
    ],
)
def test_nfkc_groups_equivalent_spellings(left: str, right: str) -> None:
    assert normalize_person_name(left) == normalize_person_name(right)


def test_hebrew_niqqud_is_not_stripped() -> None:
    """NFKC folds compatibility characters; it does not remove vowel points.

    So a name typed with niqqud stays a distinct grouping key. That is a known
    limitation of the current key, recorded here so a future change to strip
    combining marks is a deliberate one.
    """
    plain = "דוד"
    pointed = "דָוִד"
    assert normalize_person_name(plain) != normalize_person_name(pointed)


def test_different_people_stay_different() -> None:
    assert normalize_person_name("Yoni Cohen") != normalize_person_name("Yonatan Cohen")
