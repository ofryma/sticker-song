"""Canonical re-encoding: format detection, EXIF, animation, metadata stripping.

`app.images.normalize` is the only thing standing between an arbitrary upload and
the bucket. It has to identify the real format from the bytes, apply EXIF
orientation, drop every scrap of metadata (GPS included), and reduce animation to
a still.
"""

import asyncio
import io
import threading
import time

import pytest
from PIL import Image

from app import images
from app.config import settings
from tests import factories


@pytest.fixture(autouse=True)
def _webp_target(monkeypatch) -> None:
    """Pin the target format: the default is env-driven and tests assert on it."""
    monkeypatch.setattr(settings, "image_format", "webp")
    monkeypatch.setattr(settings, "image_quality", 88)


def _decode(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data))


# --- format detection --------------------------------------------------------


def test_detect_reads_the_bytes_not_the_extension() -> None:
    assert images.detect_format(factories.jpeg()) == "JPEG"
    assert images.detect_format(factories.png_with_alpha()) == "PNG"
    assert images.detect_format(factories.animated_gif()) == "GIF"


def test_detect_returns_none_for_non_images() -> None:
    assert images.detect_format(factories.not_an_image()) is None
    assert images.detect_format(b"") is None


def test_normalize_rejects_non_images() -> None:
    with pytest.raises(images.UnsupportedImage):
        images.normalize(factories.not_an_image())


def test_normalize_rejects_empty_bytes() -> None:
    with pytest.raises(images.UnsupportedImage):
        images.normalize(b"")


def test_normalize_rejects_truncated_image() -> None:
    with pytest.raises(images.UnsupportedImage):
        images.normalize(factories.jpeg()[:12])


# --- conversion --------------------------------------------------------------


@pytest.mark.parametrize(
    ("build", "source_format"),
    [
        (factories.jpeg, "JPEG"),
        (factories.png_with_alpha, "PNG"),
        (factories.animated_gif, "GIF"),
    ],
)
def test_everything_converts_to_the_configured_format(build, source_format) -> None:
    result = images.normalize(build())

    assert result.source_format == source_format
    assert result.content_type == "image/webp"
    assert result.extension == ".webp"
    assert _decode(result.data).format == "WEBP"


@pytest.mark.parametrize(
    ("fmt", "pil_format", "extension", "content_type"),
    [
        ("webp", "WEBP", ".webp", "image/webp"),
        ("png", "PNG", ".png", "image/png"),
        ("jpeg", "JPEG", ".jpg", "image/jpeg"),
    ],
)
def test_each_target_format_is_honoured(
    monkeypatch, fmt, pil_format, extension, content_type
) -> None:
    monkeypatch.setattr(settings, "image_format", fmt)

    result = images.normalize(factories.jpeg())

    assert (result.extension, result.content_type) == (extension, content_type)
    assert _decode(result.data).format == pil_format


def test_reported_size_describes_the_converted_image() -> None:
    result = images.normalize(factories.jpeg(size=(64, 48)))

    assert (result.width, result.height) == (64, 48)
    assert _decode(result.data).size == (64, 48)


# --- EXIF --------------------------------------------------------------------


def test_exif_orientation_is_applied() -> None:
    """Orientation 6 means "rotate 90° clockwise to display", so 40x20 -> 20x40."""
    result = images.normalize(factories.jpeg_with_exif(size=(40, 20), orientation=6))

    assert (result.width, result.height) == (20, 40)
    assert _decode(result.data).size == (20, 40)


def test_orientation_1_leaves_dimensions_alone() -> None:
    result = images.normalize(factories.jpeg_with_exif(size=(40, 20), orientation=1))

    assert (result.width, result.height) == (40, 20)


def test_source_exif_is_present_so_the_test_is_meaningful() -> None:
    source = _decode(factories.jpeg_with_exif())

    assert source.getexif().get(factories.ORIENTATION_TAG) == 6
    assert source.getexif().get_ifd(factories.GPS_IFD_TAG)


def test_gps_and_all_other_metadata_are_dropped() -> None:
    result = images.normalize(factories.jpeg_with_exif(gps=True))

    stored = _decode(result.data)
    assert not stored.getexif()
    assert not stored.getexif().get_ifd(factories.GPS_IFD_TAG)
    assert "exif" not in stored.info
    assert "icc_profile" not in stored.info


# --- animation ---------------------------------------------------------------


def test_animated_input_keeps_only_the_first_frame() -> None:
    source = _decode(factories.animated_gif(frames=3))
    assert source.n_frames == 3

    result = images.normalize(factories.animated_gif(frames=3))

    assert getattr(_decode(result.data), "n_frames", 1) == 1


# --- alpha -------------------------------------------------------------------


def test_alpha_survives_a_target_that_supports_it() -> None:
    result = images.normalize(factories.png_with_alpha())

    assert _decode(result.data).convert("RGBA").getchannel("A").getextrema()[1] == 0


def test_alpha_is_composited_onto_white_for_jpeg(monkeypatch) -> None:
    monkeypatch.setattr(settings, "image_format", "jpeg")

    result = images.normalize(factories.png_with_alpha())

    stored = _decode(result.data).convert("RGB")
    assert stored.getpixel((0, 0)) == (255, 255, 255)


# --- HEIC --------------------------------------------------------------------


def test_heic_from_an_iphone_is_decoded_and_converted() -> None:
    data = factories.heic()
    if data is None:
        pytest.skip("installed pillow-heif cannot encode HEIC to build a fixture")

    assert images.detect_format(data) in {"HEIF", "HEIC"}

    result = images.normalize(data)

    assert result.content_type == "image/webp"
    assert _decode(result.data).format == "WEBP"
    assert (result.width, result.height) == (30, 20)


def test_heic_decoder_is_registered() -> None:
    """The plugin is what makes iPhone uploads work; assert it actually loaded."""
    pytest.importorskip("pillow_heif")

    assert "HEIF" in Image.OPEN or "HEIC" in Image.OPEN


# --- decompression bombs -----------------------------------------------------


def test_pixel_limit_follows_the_setting() -> None:
    assert settings.max_image_megapixels * 1_000_000 == Image.MAX_IMAGE_PIXELS


def test_an_oversized_frame_is_rejected_before_it_is_decoded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The frame is refused on its header, so nothing allocates the bitmap.

    This is the memory ceiling for an upload: the 10 MB byte cap says nothing
    about the pixels behind it, because a photo of a flat sky compresses far
    below its size. A one-megapixel limit and a 1000x1000 image is the same test
    as a 50 MP limit and a 50 MP image, without building the 50 MP file.
    """
    monkeypatch.setattr(settings, "max_image_megapixels", 1)

    with pytest.raises(images.UnsupportedImage, match="over the 1 MP limit"):
        images.normalize(factories.jpeg(size=(1100, 1000)))


def test_a_frame_inside_the_limit_still_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "max_image_megapixels", 1)

    result = images.normalize(factories.jpeg(size=(900, 1000)))

    assert (result.width, result.height) == (900, 1000)


async def test_the_decode_gate_bounds_how_many_run_at_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Starlette's threadpool is forty wide; the gate is what keeps memory bounded.

    Without it forty simultaneous uploads would each hold a decoded bitmap at the
    same moment, which is an OOM on a small host well before the last finishes.
    """
    monkeypatch.setattr(settings, "image_concurrency", 2)
    monkeypatch.setattr(images, "_decode_gate", None)

    live = 0
    peak = 0
    started = threading.Lock()

    def slow_normalize(data: bytes) -> str:
        nonlocal live, peak
        with started:
            live += 1
            peak = max(peak, live)
        time.sleep(0.05)
        with started:
            live -= 1
        return "done"

    monkeypatch.setattr(images, "normalize", slow_normalize)

    results = await asyncio.gather(*(images.normalize_async(b"") for _ in range(10)))

    assert results == ["done"] * 10
    assert peak <= 2


def test_a_decompression_bomb_becomes_a_rejection_not_a_crash() -> None:
    """Pillow's own error descends from Exception, not OSError.

    Left unnamed in the handler it escapes `normalize` and becomes a 500 rather
    than the 400 the upload route turns an UnsupportedImage into.
    """
    assert issubclass(Image.DecompressionBombError, images._DECODE_ERRORS)
