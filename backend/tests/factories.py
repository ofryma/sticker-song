"""Builders for the image bytes the tests feed to the API."""

import io

from PIL import Image
from PIL.TiffImagePlugin import IFDRational

ORIENTATION_TAG = 0x0112
GPS_IFD_TAG = 0x8825


def jpeg(size: tuple[int, int] = (40, 20), color: str = "red") -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, "JPEG")
    return buffer.getvalue()


def png_with_alpha(size: tuple[int, int] = (10, 10)) -> bytes:
    buffer = io.BytesIO()
    # Fully transparent: a target without alpha must composite it onto white
    # rather than let the encoder reveal whatever the buffer held.
    Image.new("RGBA", size, (0, 0, 0, 0)).save(buffer, "PNG")
    return buffer.getvalue()


def jpeg_with_exif(
    size: tuple[int, int] = (40, 20), orientation: int = 6, gps: bool = True
) -> bytes:
    """A photo carrying orientation and (optionally) GPS, like a phone's."""
    exif = Image.Exif()
    exif[ORIENTATION_TAG] = orientation
    if gps:
        # 32.0853N 34.7818E as EXIF rationals — the value the archive must drop.
        exif[GPS_IFD_TAG] = {
            1: "N",
            2: (IFDRational(32), IFDRational(5), IFDRational(7)),
            3: "E",
            4: (IFDRational(34), IFDRational(46), IFDRational(54)),
        }
    buffer = io.BytesIO()
    Image.new("RGB", size, "blue").save(buffer, "JPEG", exif=exif)
    return buffer.getvalue()


def animated_gif(size: tuple[int, int] = (12, 8), frames: int = 3) -> bytes:
    # Visibly different frames: the GIF writer drops a frame identical to the
    # one before it, which would leave a "0 frames animated" fixture.
    palette = [(255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0)]
    first, *rest = [
        Image.new("RGB", size, palette[i % len(palette)]).convert(
            "P", palette=Image.Palette.ADAPTIVE
        )
        for i in range(frames)
    ]
    buffer = io.BytesIO()
    first.save(buffer, "GIF", save_all=True, append_images=rest, duration=100, loop=0)
    return buffer.getvalue()


def heic(size: tuple[int, int] = (30, 20)) -> bytes | None:
    """HEIC bytes, or None when the installed pillow-heif cannot encode them.

    Decoding HEIC is the part that matters for iPhone uploads and is always
    available; the encoder depends on how libheif was built.
    """
    try:
        import pillow_heif  # noqa: F401
    except ImportError:
        return None
    buffer = io.BytesIO()
    try:
        Image.new("RGB", size, "green").save(buffer, "HEIF")
    except (OSError, ValueError, KeyError):
        return None
    return buffer.getvalue()


def not_an_image() -> bytes:
    return b"this is plain text, not a photograph of anything"
