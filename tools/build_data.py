"""Build data/*.json from the hand-checked sources in content/.

Usage:  python tools/build_data.py

Inputs
  content/en/<chapter>.md, content/ru/<chapter>.md   brochure text (format below)
  content/questions/<chapter>.json                   questions (EN + RU fields)
  content/chapters.json                              chapter order
Outputs
  data/blocks.en.json, data/blocks.ru.json
  data/questions.en.json, data/questions.ru.json

Text format (content/<lang>/<chapter>.md):
  @chapter <id>            @title <title>           @pages 10-13
  @block <id> <kind> <page>     kind: intro | section | aside | photo
  @heading <text>
  @img <chapter-relative file> <caption (optional)>
  Paragraphs are separated by blank lines.
  Key facts are marked inline as [[exact text|type]].
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
DATA = ROOT / "data"
KEY_RE = re.compile(r"\[\[([^\]|]+)\|([a-z-]+)\]\]")


def parse_chapter(path: Path) -> dict:
    chapter: dict = {"blocks": []}
    block = None
    para: list[str] = []

    def flush_para():
        nonlocal para
        if para and block is not None:
            raw = " ".join(s.strip() for s in para)
            facts = [{"text": m.group(1), "type": m.group(2)} for m in KEY_RE.finditer(raw)]
            text = KEY_RE.sub(lambda m: m.group(1), raw)
            block["paragraphs"].append(text)
            for f in facts:
                if f not in block["keyFacts"]:
                    block["keyFacts"].append(f)
        para = []

    for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if line.startswith("@"):
            flush_para()
            cmd, _, rest = line[1:].partition(" ")
            rest = rest.strip()
            if cmd == "chapter":
                chapter["id"] = rest
            elif cmd == "title":
                chapter["title"] = rest
            elif cmd == "pages":
                a, _, b = rest.partition("-")
                chapter["pages"] = [int(a), int(b or a)]
            elif cmd == "block":
                bid, kind, page = rest.split()
                block = {"id": bid, "kind": kind, "page": int(page), "heading": "",
                         "images": [], "paragraphs": [], "keyFacts": []}
                chapter["blocks"].append(block)
            elif cmd == "heading":
                block["heading"] = rest
            elif cmd == "img":
                src, _, caption = rest.partition(" ")
                block["images"].append({"src": f"img/{chapter['id']}/{src}", "caption": caption.strip()})
            else:
                raise SystemExit(f"{path}:{lineno}: unknown command @{cmd}")
        elif not line.strip():
            flush_para()
        else:
            para.append(line)
    flush_para()
    return chapter


def main() -> int:
    order = json.loads((CONTENT / "chapters.json").read_text(encoding="utf-8"))["chapters"]
    DATA.mkdir(exist_ok=True)
    for lang in ("en", "ru"):
        chapters = []
        for cid in order:
            path = CONTENT / lang / f"{cid}.md"
            if path.exists():
                chapters.append(parse_chapter(path))
        out = DATA / f"blocks.{lang}.json"
        out.write_text(json.dumps({"chapters": chapters}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{out.relative_to(ROOT)}: {len(chapters)} chapters, "
              f"{sum(len(c['blocks']) for c in chapters)} blocks")

    q_en, q_ru = [], []
    for cid in order:
        path = CONTENT / "questions" / f"{cid}.json"
        if not path.exists():
            continue
        for q in json.loads(path.read_text(encoding="utf-8")):
            base = {"id": q["id"], "chapter": cid, "blockId": q["blockId"],
                    "question": q["question"], "options": q["options"], "answer": q["answer"]}
            q_en.append({**base, "explanation": q["explanationEn"]})
            q_ru.append({**base, "explanation": q["explanationRu"],
                         "questionRu": q["questionRu"], "optionsRu": q["optionsRu"]})
    for lang, qs in (("en", q_en), ("ru", q_ru)):
        out = DATA / f"questions.{lang}.json"
        out.write_text(json.dumps(qs, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"data/questions.*.json: {len(q_en)} questions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
