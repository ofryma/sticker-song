"""Format detection and canonical re-encoding for uploaded photos.

The client's ``Content-Type`` header and the filename suffix are both hints we
do not trust. Every upload is decoded from its bytes, the real format is read
from the decoder, and the image is re-encoded into the single canonical format
configured by ``IMAGE_FORMAT``. That keeps the bucket homogeneous, strips EXIF
(location data included), and normalizes orientation so a phone photo is not
served rotated.
"""

import asyncio
import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.config import settings

# Guard against decompression bombs, and against a merely large photo on a small
# server: we decode before we know anything about the file, and a decoded frame
# costs roughly 3 bytes a pixel. Pillow raises DecompressionBombError past this,
# which arrives here as the UnsupportedImage every caller already handles.
Image.MAX_IMAGE_PIXELS = settings.max_image_megapixels * 1_000_000

try:  # iPhone photos arrive as HEIC; the plugin registers the decoder with PIL.
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover - HEIC support is optional at runtime
    pillow_heif = None


@dataclass(frozen=True)
class _Target:
    pil_format: str
    extension: str
    content_type: str
    supports_alpha: bool


TARGETS = {
    "webp": _Target("WEBP", ".webp", "image/webp", supports_alpha=True),
    "png": _Target("PNG", ".png", "image/png", supports_alpha=True),
    "jpeg": _Target("JPEG", ".jpg", "image/jpeg", supports_alpha=False),
}


class UnsupportedImage(Exception):
    """The bytes are not a decodable image, or not one we can re-encode."""


# Every decode path catches these. Pillow's DecompressionBombError descends
# straight from Exception rather than from OSError, so it has to be named
# explicitly or an oversized upload becomes a 500 instead of a rejection.
_DECODE_ERRORS = (
    UnidentifiedImageError,
    Image.DecompressionBombError,
    OSError,
    ValueError,
)


def _check_pixels(image: Image.Image) -> None:
    """Reject a frame too large to decode before any pixels are read.

    ``Image.open`` parses the header only, so the dimensions are known while the
    bitmap still costs nothing. Pillow's own guard is not enough on its own: it
    only warns at ``MAX_IMAGE_PIXELS`` and does not raise until twice that, which
    would let a 90 MP frame through a 50 MP limit.
    """
    width, height = image.size
    limit = settings.max_image_megapixels * 1_000_000
    if width * height > limit:
        raise UnsupportedImage(
            f"image is {width}x{height}, over the "
            f"{settings.max_image_megapixels} MP limit"
        )


@dataclass(frozen=True)
class NormalizedImage:
    """The re-encoded image, ready to store."""

    data: bytes
    content_type: str
    extension: str
    source_format: str
    width: int
    height: int


def target() -> _Target:
    """The configured canonical format. `Settings` validates the name at boot."""
    return TARGETS[settings.image_format]


def detect_format(data: bytes) -> str | None:
    """The real format of the bytes (``"JPEG"``, ``"HEIF"``, ...), or None.

    Reads the decoder's own verdict rather than the declared MIME type, so a
    ``.png`` that is really a JPEG -- or a text file claiming ``image/jpeg`` --
    is identified correctly.
    """
    try:
        with Image.open(io.BytesIO(data)) as image:
            return image.format
    except (UnidentifiedImageError, OSError, ValueError):
        return None


def _flatten(image: Image.Image, supports_alpha: bool) -> Image.Image:
    """Put the image into a mode the target encoder accepts."""
    has_alpha = image.mode in {"RGBA", "LA", "PA"} or (
        image.mode == "P" and "transparency" in image.info
    )
    if has_alpha:
        if supports_alpha:
            return image.convert("RGBA")
        # No alpha channel in the target: composite onto white rather than
        # letting the encoder drop the channel and reveal whatever was behind it.
        backdrop = Image.new("RGB", image.size, (255, 255, 255))
        backdrop.paste(image.convert("RGBA"), mask=image.convert("RGBA").getchannel("A"))
        return backdrop
    return image.convert("RGB")


def _encode(image: Image.Image, spec: _Target) -> bytes:
    buffer = io.BytesIO()
    options: dict[str, object] = {}
    if spec.pil_format == "WEBP":
        options = {"quality": settings.image_quality, "method": 6}
    elif spec.pil_format == "JPEG":
        options = {
            "quality": settings.image_quality,
            "optimize": True,
            "progressive": True,
        }
    elif spec.pil_format == "PNG":
        options = {"optimize": True}
    # No `exif`/`icc_profile` passed through: metadata is deliberately dropped.
    image.save(buffer, format=spec.pil_format, **options)
    return buffer.getvalue()


def make_thumbnail(data: bytes) -> NormalizedImage:
    """A small copy of an already-normalized image, in the same canonical format.

    The wall grid and the collage show dozens of tiles at a few hundred pixels
    wide; serving the full-size upload to each of them is a heavy mobile payload
    for pixels nobody sees. Aspect ratio is preserved and an image already inside
    the box is left at its own size rather than upscaled.
    """
    spec = target()
    try:
        with Image.open(io.BytesIO(data)) as opened:
            source_format = opened.format or "UNKNOWN"
            _check_pixels(opened)
            image = _flatten(opened, spec.supports_alpha)
            edge = settings.thumbnail_max_edge
            image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            encoded = _encode(image, spec)
            width, height = image.size
    except UnsupportedImage:
        raise
    except _DECODE_ERRORS as exc:
        raise UnsupportedImage(str(exc)) from exc

    return NormalizedImage(
        data=encoded,
        content_type=spec.content_type,
        extension=spec.extension,
        source_format=source_format,
        width=width,
        height=height,
    )


def _gate() -> asyncio.Semaphore:
    """The decode gate, created on the loop that first asks for it.

    Built lazily rather than at import: a module-level semaphore is created
    outside any running loop, and the test suite runs several loops in one
    process. One gate per loop is exactly the scope we want.
    """
    global _decode_gate
    loop = asyncio.get_running_loop()
    if _decode_gate is None or _decode_gate[0] is not loop:
        _decode_gate = (loop, asyncio.Semaphore(settings.image_concurrency))
    return _decode_gate[1]


_decode_gate: tuple[asyncio.AbstractEventLoop, asyncio.Semaphore] | None = None


async def normalize_async(data: bytes) -> NormalizedImage:
    """``normalize`` off the event loop, with at most IMAGE_CONCURRENCY at once.

    Decoding is the memory peak of the whole application, and Starlette's
    threadpool is forty threads wide — without this, forty simultaneous uploads
    would each hold a bitmap and the host would OOM long before the last one
    finished. The gate makes a burst queue instead.
    """
    async with _gate():
        return await run_in_threadpool(normalize, data)


async def make_thumbnail_async(data: bytes) -> NormalizedImage:
    """``make_thumbnail`` off the event loop, behind the same gate."""
    async with _gate():
        return await run_in_threadpool(make_thumbnail, data)


def normalize(data: bytes) -> NormalizedImage:
    """Decode any supported image and re-encode it into the canonical format.

    Raises ``UnsupportedImage`` when the bytes cannot be decoded.
    """
    spec = target()
    try:
        with Image.open(io.BytesIO(data)) as opened:
            source_format = opened.format or "UNKNOWN"
            _check_pixels(opened)
            # Animated input keeps its first frame only; the archive shows stills.
            if getattr(opened, "n_frames", 1) > 1:
                opened.seek(0)
            image = ImageOps.exif_transpose(opened) or opened
            image = _flatten(image, spec.supports_alpha)
            encoded = _encode(image, spec)
            width, height = image.size
    except UnsupportedImage:
        raise
    except _DECODE_ERRORS as exc:
        raise UnsupportedImage(str(exc)) from exc

    return NormalizedImage(
        data=encoded,
        content_type=spec.content_type,
        extension=spec.extension,
        source_format=source_format,
        width=width,
        height=height,
    )
