"""Format detection and canonical re-encoding for uploaded photos.

The client's ``Content-Type`` header and the filename suffix are both hints we
do not trust. Every upload is decoded from its bytes, the real format is read
from the decoder, and the image is re-encoded into the single canonical format
configured by ``IMAGE_FORMAT``. That keeps the bucket homogeneous, strips EXIF
(location data included), and normalizes orientation so a phone photo is not
served rotated.
"""

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

from app.config import settings

# Guard against decompression bombs: a 100 MP frame is far past any real photo,
# and we decode before we know anything about the file.
Image.MAX_IMAGE_PIXELS = 100_000_000

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
            image = _flatten(opened, spec.supports_alpha)
            edge = settings.thumbnail_max_edge
            image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            encoded = _encode(image, spec)
            width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise UnsupportedImage(str(exc)) from exc

    return NormalizedImage(
        data=encoded,
        content_type=spec.content_type,
        extension=spec.extension,
        source_format=source_format,
        width=width,
        height=height,
    )


def normalize(data: bytes) -> NormalizedImage:
    """Decode any supported image and re-encode it into the canonical format.

    Raises ``UnsupportedImage`` when the bytes cannot be decoded.
    """
    spec = target()
    try:
        with Image.open(io.BytesIO(data)) as opened:
            source_format = opened.format or "UNKNOWN"
            # Animated input keeps its first frame only; the archive shows stills.
            if getattr(opened, "n_frames", 1) > 1:
                opened.seek(0)
            image = ImageOps.exif_transpose(opened) or opened
            image = _flatten(image, spec.supports_alpha)
            encoded = _encode(image, spec)
            width, height = image.size
    except UnsupportedImage:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise UnsupportedImage(str(exc)) from exc

    return NormalizedImage(
        data=encoded,
        content_type=spec.content_type,
        extension=spec.extension,
        source_format=source_format,
        width=width,
        height=height,
    )
