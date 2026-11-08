"""Validate data/*.json. Exit code 1 on any error (used before push and in CI).

Checks
  * EN and RU have the same chapters and the same block ids in the same order
  * every keyFacts[].text is an exact substring of the block's paragraphs; type is known
  * every image file exists in public/
  * questions: unique ids, blockId exists, chapter matches, 2+ unique options,
    answer in range, explanation present; EN and RU banks have the same ids,
    RU has questionRu/optionsRu of the right length
  * data/tts-fixes.*.json are {string: string}
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
FACT_TYPES = {"date", "person", "number", "definition", "place", "symbol", "right-duty"}
BLOCK_KINDS = {"intro", "section", "aside", "photo", "text", "verse"}

errors: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def load(name: str):
    try:
        return json.loads((DATA / name).read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        err(f"{name}: cannot read ({e})")
        return None


def check_blocks(lang: str, doc: dict) -> dict[str, str]:
    """Return {blockId: chapterId}."""
    ids: dict[str, str] = {}
    for ch in doc.get("chapters", []):
        if not ch.get("title"):
            err(f"{lang}/{ch.get('id')}: empty chapter title")
        for b in ch["blocks"]:
            where = f"{lang}/{b['id']}"
            if b["id"] in ids:
                err(f"{where}: duplicate block id")
            ids[b["id"]] = ch["id"]
            if b.get("kind") not in BLOCK_KINDS:
                err(f"{where}: unknown kind {b.get('kind')!r}")
            if not b["paragraphs"]:
                err(f"{where}: no paragraphs")
            if b.get("kind") in ("section", "aside") and not b.get("heading"):
                err(f"{where}: section/aside without heading")
            text = "\n".join(b["paragraphs"])
            for f in b["keyFacts"]:
                if f["type"] not in FACT_TYPES:
                    err(f"{where}: key fact {f['text']!r} has unknown type {f['type']!r}")
                if f["text"] not in text:
                    err(f"{where}: key fact {f['text']!r} not found in text")
            for img in b["images"]:
                if not (ROOT / "public" / img["src"]).is_file():
                    err(f"{where}: image public/{img['src']} missing (run tools/extract_images.py)")
    return ids


def main() -> int:
    blocks = {lang: load(f"blocks.{lang}.json") for lang in ("en", "ru")}
    ids = {lang: check_blocks(lang, d) if d else {} for lang, d in blocks.items()}

    if blocks["en"] and blocks["ru"]:
        ch_en = [c["id"] for c in blocks["en"]["chapters"]]
        ch_ru = [c["id"] for c in blocks["ru"]["chapters"]]
        if ch_en != ch_ru:
            err(f"chapter ids differ: en={ch_en} ru={ch_ru}")
        if list(ids["en"]) != list(ids["ru"]):
            only_en = sorted(set(ids["en"]) - set(ids["ru"]))
            only_ru = sorted(set(ids["ru"]) - set(ids["en"]))
            err(f"block ids differ (or order): only en={only_en} only ru={only_ru}")

    banks = {lang: load(f"questions.{lang}.json") or [] for lang in ("en", "ru")}
    for lang, qs in banks.items():
        seen = set()
        for q in qs:
            where = f"questions.{lang}/{q.get('id')}"
            if q["id"] in seen:
                err(f"{where}: duplicate id")
            seen.add(q["id"])
            chapter = ids[lang].get(q["blockId"])
            if chapter is None:
                err(f"{where}: blockId {q['blockId']!r} does not exist")
            elif chapter != q["chapter"]:
                err(f"{where}: chapter {q['chapter']!r} but block is in {chapter!r}")
            opts = q["options"]
            if len(opts) < 2 or len(set(opts)) != len(opts):
                err(f"{where}: need 2+ unique options")
            if not isinstance(q["answer"], int) or not 0 <= q["answer"] < len(opts):
                err(f"{where}: answer {q['answer']!r} out of range")
            if not q.get("question", "").strip() or not q.get("explanation", "").strip():
                err(f"{where}: empty question or explanation")
            if lang == "ru":
                if len(q.get("optionsRu", [])) != len(opts) or not q.get("questionRu"):
                    err(f"{where}: questionRu/optionsRu missing or wrong length")
    if {q["id"] for q in banks["en"]} != {q["id"] for q in banks["ru"]}:
        err("question ids differ between EN and RU")

    ont = load("ontario.json")
    if ont:
        if not str(ont.get("checked", "")).startswith("20"):
            err("ontario.json: 'checked' date missing")
        for f in ont.get("facts", []):
            if not (f.get("value") and f.get("valueRu") and str(f.get("source", "")).startswith("https://")):
                err(f"ontario.json: fact {f.get('en')!r} needs value, valueRu and https source")
        qids = set()
        for q in ont.get("questions", []):
            where = f"ontario.json/{q.get('id')}"
            if q["id"] in qids:
                err(f"{where}: duplicate id")
            qids.add(q["id"])
            n = len(q["options"])
            if n < 2 or len(set(q["options"])) != n or not 0 <= q["answer"] < n:
                err(f"{where}: bad options/answer")
            if len(q.get("optionsRu", [])) != n or not q.get("questionRu") or not q.get("explanationRu") or not q.get("explanationEn"):
                err(f"{where}: RU/EN fields missing")

    for lang in ("en", "ru"):
        fixes = load(f"tts-fixes.{lang}.json")
        if fixes is not None and not (isinstance(fixes, dict) and all(
                isinstance(k, str) and isinstance(v, str) for k, v in fixes.items())):
            err(f"tts-fixes.{lang}.json must be an object of strings")

    n_blocks = len(ids["en"])
    n_facts = sum(len(b["keyFacts"]) for c in (blocks["en"] or {}).get("chapters", []) for b in c["blocks"])
    if errors:
        print(f"FAILED: {len(errors)} error(s)")
        for e in errors:
            print("  -", e)
        return 1
    print(f"OK: {n_blocks} blocks, {n_facts} EN key facts, {len(banks['en'])} questions")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.exit(main())
