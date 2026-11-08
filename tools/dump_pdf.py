"""Dump PDF text and image list per page into tools/tmp/ (helper for writing content/*.md).

Usage:  python tools/dump_pdf.py source/discover-canada-en.pdf [first_page] [last_page]
Writes tools/tmp/<pdf-name>.txt with page text, section headings and image xrefs/positions.
"""
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent


def main() -> int:
    pdf = Path(sys.argv[1])
    doc = pymupdf.open(pdf)
    first = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    last = int(sys.argv[3]) if len(sys.argv) > 3 else doc.page_count
    out = ROOT / "tools" / "tmp" / (pdf.stem + ".txt")
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as w:
        for n in range(first, last + 1):
            page = doc[n - 1]
            w.write(f"\n######## PAGE {n}\n")
            for info in page.get_image_info(xrefs=True):
                bb = [round(v) for v in info["bbox"]]
                if bb[2] <= 0 or bb[0] >= page.rect.width:
                    continue  # belongs to the facing page of a spread
                w.write(f"[img xref={info['xref']} {info['width']}x{info['height']} bbox={bb}]\n")
            w.write(page.get_text())
    print(f"written {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
