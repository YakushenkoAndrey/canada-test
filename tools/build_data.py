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

import build_local  # noqa: E402  (tools/ is on sys.path when run as a script)

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
DATA = ROOT / "data"
KEY_RE = re.compile(r"\[\[([^\]|]+)\|([a-z-]+)\]\]")


def jpeg_size(path: Path) -> tuple[int, int]:
    """(width, height) of a JPEG file, read from its SOF marker; (0, 0) if unknown."""
    try:
        data = path.read_bytes()
    except OSError:
        return 0, 0
    i = 2
    while i + 9 < len(data):
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        length = int.from_bytes(data[i + 2:i + 4], "big")
        if marker in (0xC0, 0xC1, 0xC2):
            return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
        i += 2 + length
    return 0, 0


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
                rel = f"img/{chapter['id']}/{src}"
                w, h = jpeg_size(ROOT / "public" / rel)
                block["images"].append({"src": rel, "caption": caption.strip(), "w": w, "h": h})
            else:
                raise SystemExit(f"{path}:{lineno}: unknown command @{cmd}")
        elif not line.strip():
            flush_para()
        else:
            para.append(line)
    flush_para()
    return chapter


def parse_questions(path: Path, cid: str) -> list[dict]:
    """Compact question format (content/questions/<chapter>.txt), 7 lines per question:

        @q <number> <blockId> <answer index from 0>
        English question
        | option A | option B | option C | option D
        = English explanation
        ? Russian question
        | вариант A | вариант B | вариант C | вариант D
        = Russian explanation
    Blank lines and lines starting with # are ignored.
    """
    lines = [l.rstrip() for l in path.read_text(encoding="utf-8").splitlines()]
    lines = [l for l in lines if l.strip() and not l.lstrip().startswith("#")]
    out = []
    i = 0
    while i < len(lines):
        head = lines[i]
        if not head.startswith("@q "):
            raise SystemExit(f"{path}: expected '@q', got {head!r}")
        try:
            _, num, block_id, ans = head.split()
            q_en, opt_en, ex_en, q_ru, opt_ru, ex_ru = lines[i + 1:i + 7]
        except ValueError:
            raise SystemExit(f"{path}: bad question near {head!r}")
        opts = lambda s: [o.strip() for o in s.strip().strip("|").split("|")]  # noqa: E731
        for line, mark in ((opt_en, "|"), (ex_en, "="), (q_ru, "?"), (opt_ru, "|"), (ex_ru, "=")):
            if not line.startswith(mark):
                raise SystemExit(f"{path}: {head}: line {line!r} should start with {mark!r}")
        out.append({
            "id": f"q-{cid}-{int(num):03d}", "blockId": block_id, "answer": int(ans),
            "question": q_en.strip(), "options": opts(opt_en), "explanationEn": ex_en[1:].strip(),
            "questionRu": q_ru[1:].strip(), "optionsRu": opts(opt_ru), "explanationRu": ex_ru[1:].strip(),
        })
        i += 7
    return out


def parse_translations(path: Path) -> dict[str, dict]:
    """Question translations for one language (content/questions/<lang>/<chapter>.txt), 4 lines each:

        @q <number>
        ? translated question
        | option A | option B | option C | option D
        = explanation in this language
    """
    lines = [l.rstrip() for l in path.read_text(encoding="utf-8").splitlines()]
    lines = [l for l in lines if l.strip() and not l.lstrip().startswith("#")]
    cid = path.stem
    out: dict[str, dict] = {}
    for i in range(0, len(lines), 4):
        head, q, opts, ex = (lines[i:i + 4] + ["", "", "", ""])[:4]
        if not head.startswith("@q ") or not q.startswith("?") or not opts.startswith("|") or not ex.startswith("="):
            raise SystemExit(f"{path}: bad translation near {head!r}")
        qid = f"q-{cid}-{int(head.split()[1]):03d}"
        out[qid] = {"questionTr": q[1:].strip(),
                    "optionsTr": [o.strip() for o in opts.strip().strip("|").split("|")],
                    "explanation": ex[1:].strip()}
    return out


def main() -> int:
    order = json.loads((CONTENT / "chapters.json").read_text(encoding="utf-8"))["chapters"]
    langs = json.loads((CONTENT / "languages.json").read_text(encoding="utf-8"))["languages"]
    DATA.mkdir(exist_ok=True)

    # Base question bank (English + Russian fields live in content/questions/<chapter>.txt|json).
    base_q: list[dict] = []
    for cid in order:
        items = []
        path = CONTENT / "questions" / f"{cid}.json"
        if path.exists():
            items += json.loads(path.read_text(encoding="utf-8"))
        path = CONTENT / "questions" / f"{cid}.txt"
        if path.exists():
            items += parse_questions(path, cid)
        for q in items:
            base_q.append({**q, "chapter": cid})

    published = []
    for L in langs:
        lang = L["code"]
        files = [CONTENT / lang / f"{cid}.md" for cid in order]
        if not all(f.exists() for f in files):
            have = sum(f.exists() for f in files)
            if have:
                print(f"{lang}: {have}/{len(order)} chapters - not published yet")
            continue
        chapters = [parse_chapter(f) for f in files]
        out = DATA / f"blocks.{lang}.json"
        out.write_text(json.dumps({"chapters": chapters}, ensure_ascii=False, indent=1) + "\n",
                       encoding="utf-8", newline="\n")

        tr: dict[str, dict] = {}
        tdir = CONTENT / "questions" / lang
        if tdir.is_dir():
            for f in sorted(tdir.glob("*.txt")):
                tr.update(parse_translations(f))
        qs = []
        for q in base_q:
            item = {"id": q["id"], "chapter": q["chapter"], "blockId": q["blockId"],
                    "question": q["question"], "options": q["options"], "answer": q["answer"]}
            if lang == "en":
                item["explanation"] = q["explanationEn"]
            elif lang == "ru":
                item.update(explanation=q["explanationRu"], questionTr=q["questionRu"], optionsTr=q["optionsRu"])
            elif q["id"] in tr:
                item.update(tr[q["id"]])
            else:
                item["explanation"] = q["explanationEn"]
                item["missingTr"] = True
            qs.append(item)
        (DATA / f"questions.{lang}.json").write_text(json.dumps(qs, ensure_ascii=False, indent=1) + "\n",
                                                    encoding="utf-8", newline="\n")
        published.append({k: L[k] for k in L if not k.startswith("_")})
        print(f"{lang}: {len(chapters)} chapters, {sum(len(c['blocks']) for c in chapters)} blocks, "
              f"{len(qs)} questions ({sum(1 for q in qs if q.get('missingTr'))} without translation)")

    (DATA / "languages.json").write_text(json.dumps(published, ensure_ascii=False, indent=1) + "\n",
                                         encoding="utf-8", newline="\n")
    build_local.main()
    return 0


if __name__ == "__main__":
    sys.exit(main())
