"""Generate app icons for the PWA / iPhone home screen into public/icons/.

Usage:  python tools/make_icons.py   (needs Pillow; uses a serif system font if available)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons"
RED = (135, 22, 25)
STRIP = (235, 198, 194)
FONTS = ["C:/Windows/Fonts/georgiab.ttf", "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
         "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"]


def font(size: int):
    for f in FONTS:
        if Path(f).exists():
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def icon(size: int, maskable: bool = False) -> Image.Image:
    img = Image.new("RGB", (size, size), RED)
    d = ImageDraw.Draw(img)
    pad = int(size * (0.18 if maskable else 0.08))
    # thin light bar at the bottom, like the brochure footer strip
    d.rectangle([pad, size - pad - size // 28, size - pad, size - pad], fill=STRIP)
    f = font(int(size * (0.36 if maskable else 0.44)))
    text = "DC"
    box = d.textbbox((0, 0), text, font=f)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1] - size * 0.03), text, font=f, fill="white")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192).save(OUT / "icon-192.png")
    icon(512).save(OUT / "icon-512.png")
    icon(512, maskable=True).save(OUT / "icon-maskable-512.png")
    icon(180).save(OUT / "apple-touch-icon.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
