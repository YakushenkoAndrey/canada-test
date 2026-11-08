"""Extract brochure photos from the English PDF into public/img/.

Usage:  python tools/extract_images.py [--pdf source/discover-canada-en.pdf]

The list of photos lives in content/images.json:
    "<chapter>/<file>.jpg": {"page": <brochure page>, "xref": <PDF image id>}
Use tools/dump_pdf.py to find xrefs of the images on a page.
Images are re-encoded as JPEG (quality 85) so CMYK photos display in browsers.
"""
import argparse
import json
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=str(ROOT / "source" / "discover-canada-en.pdf"))
    args = ap.parse_args()

    spec = json.loads((ROOT / "content" / "images.json").read_text(encoding="utf-8"))
    doc = pymupdf.open(args.pdf)
    out_dir = ROOT / "public" / "img"
    count = 0
    for name, info in spec.items():
        if name.startswith("_"):
            continue
        page = doc[info["page"] - 1]
        xrefs = {img[0] for img in page.get_images(full=True)}
        if info["xref"] not in xrefs:
            print(f"ERROR {name}: xref {info['xref']} not on page {info['page']}", file=sys.stderr)
            return 1
        pix = pymupdf.Pixmap(doc, info["xref"])
        if pix.n - pix.alpha >= 4:  # CMYK -> RGB
            pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
        if pix.alpha:
            pix = pymupdf.Pixmap(pix, 0)
        target = out_dir / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(pix.tobytes("jpeg", jpg_quality=85))
        count += 1
    print(f"extracted {count} images -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
