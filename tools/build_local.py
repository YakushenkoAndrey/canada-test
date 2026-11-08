"""content/local.json -> data/local.json: "Your city and province" facts and quiz questions (en/ru/uk).

The source lists who holds office (national, per province, per city). Here we turn it into
fact rows and multiple-choice questions; wrong options are other provinces' premiers, other
cities' mayors and so on, chosen deterministically so the data file is stable between builds.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = ("en", "ru", "uk")
PREMIERS_SRC = "https://en.wikipedia.org/wiki/List_of_current_first_ministers_of_Canada"
LG_SRC = "https://www.craigmarlatt.com/canada/government/lieutenant_governors.html"
GG = {"en": "Louise Arbour", "ru": "Луиза Арбур", "uk": "Луїза Арбур"}

MEMBERS = {
    "MLA": {"en": "MLAs (Members of the Legislative Assembly)", "ru": "MLA (члены Законодательного собрания)", "uk": "MLA (члени Законодавчих зборів)"},
    "MPP": {"en": "MPPs (Members of Provincial Parliament)", "ru": "MPP (члены Провинциального парламента)", "uk": "MPP (члени Провінційного парламенту)"},
    "MNA": {"en": "MNAs (Members of the National Assembly)", "ru": "MNA (члены Национального собрания)", "uk": "MNA (члени Національних зборів)"},
    "MHA": {"en": "MHAs (Members of the House of Assembly)", "ru": "MHA (члены Палаты собрания)", "uk": "MHA (члени Палати зборів)"},
}
# Ontario keeps the ids of the original Ontario/Brantford questions (progress and mistakes refer to them).
OLD_IDS = {("ON", "capital"): "q-ontario-001", ("ON", "premier"): "q-ontario-002",
           ("ON", "lg"): "q-ontario-003", ("ON", "members"): "q-ontario-007"}


def fmt(t: dict, **kw) -> dict:
    """Fill a {en,ru,uk} template with {en,ru,uk} values."""
    return {l: t[l].format(**{k: (v[l] if isinstance(v, dict) else v) for k, v in kw.items()}) for l in LANGS}


def rank(seed: str, items: list[dict]) -> list[dict]:
    """Deterministic pseudo-random order."""
    return sorted(items, key=lambda x: hashlib.md5((seed + x["en"]).encode()).hexdigest())


def choice_q(qid: str, question: dict, right: dict, wrong: list[dict], expl: dict) -> dict:
    seen = {right["en"]}
    opts = []
    for w in wrong:
        if w["en"] not in seen:
            seen.add(w["en"])
            opts.append(w)
        if len(opts) == 3:
            break
    assert len(opts) == 3, qid
    pos = int(hashlib.md5(qid.encode()).hexdigest(), 16) % 4
    opts.insert(pos, right)
    return {"id": qid, "question": question["en"], "options": [o["en"] for o in opts], "answer": pos,
            "questionTr": {l: question[l] for l in ("ru", "uk")},
            "optionsTr": {l: [o[l] for o in opts] for l in ("ru", "uk")},
            "explanation": expl}


def fact(label: dict, value: dict, source: str) -> dict:
    return {"label": label, "value": value, "source": source}


def build(src: dict) -> dict:
    provs = {p["code"]: p for p in src["provinces"]}
    cities = {c["id"]: c for c in src["cities"]}
    for c in src["cities"]:
        assert c["province"] in provs, c["id"]
    for p in src["provinces"]:
        assert p["capital"] in cities, p["code"]

    def cname(cid: str) -> dict:
        return cities[cid]["name"]

    def qname(c: dict) -> dict:
        return c.get("nameQ", c["name"])

    out_prov = {}
    for p in src["provinces"]:
        code, P = p["code"], p["name"]
        facts, qs = [], []
        cap = p.get("capitalNote", cname(p["capital"]))
        facts.append(fact(fmt({"en": "Capital of {p}", "ru": "Столица провинции {p}", "uk": "Столиця провінції {p}"}, p=P), cap,
                          p.get("capitalSource", "https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada/read-online/canadas-regions.html")))
        lg = p["lg"]
        lg_val = {l: lg["name"][l] + (f" ({lg['since'][l]})" if "since" in lg else "") for l in LANGS}
        facts.append(fact(fmt({"en": "Lieutenant Governor of {p}", "ru": "Вице-губернатор провинции {p}", "uk": "Лейтенант-губернатор провінції {p}"}, p=P),
                          lg_val, lg.get("source", LG_SRC)))
        pr = p["premier"]
        facts.append(fact(fmt({"en": "Premier of {p}", "ru": "Премьер провинции {p}", "uk": "Прем’єр провінції {p}"}, p=P),
                          pr["value"], pr.get("source", PREMIERS_SRC)))
        mem = MEMBERS[p["members"]]
        facts.append(fact(fmt({"en": "Members of the legislature of {p} are called", "ru": "Депутатов законодательного собрания провинции {p} называют",
                               "uk": "Депутатів законодавчих зборів провінції {p} називають"}, p=P), mem, p["membersLookup"]))
        facts += p.get("extraFacts", [])

        others = [o for o in src["provinces"] if o["code"] != code]
        # capital: other cities of this province first, then other capitals
        wrong_caps = rank(code, [c["name"] for c in src["cities"] if c["province"] == code and c["id"] != p["capital"]]) + \
            rank(code, [cname(o["capital"]) for o in others])
        qs.append(choice_q(OLD_IDS.get((code, "capital"), f"loc-{code}-capital"),
                           fmt({"en": "What is the capital of {p}?", "ru": "Какой город — столица провинции {p}?", "uk": "Яке місто — столиця провінції {p}?"}, p=P),
                           cname(p["capital"]), wrong_caps,
                           fmt({"en": "The capital of {p} is {c}.", "ru": "Столица провинции {p} — {c}.", "uk": "Столиця провінції {p} — {c}."}, p=P, c=cap)))
        wrong_pr = ([pr["prev"]] if "prev" in pr else []) + rank(code, [o["premier"]["name"] for o in others])
        qs.append(choice_q(OLD_IDS.get((code, "premier"), f"loc-{code}-premier"),
                           pr.get("question", fmt({"en": "Who is the Premier of {p}?", "ru": "Кто премьер провинции {p}?", "uk": "Хто прем’єр провінції {p}?"}, p=P)),
                           pr["name"], wrong_pr, pr["value"]))
        wrong_lg = [GG] + rank(code, [o["lg"]["name"] for o in others])
        qs.append(choice_q(OLD_IDS.get((code, "lg"), f"loc-{code}-lg"),
                           fmt({"en": "Who is the Lieutenant Governor of {p}?", "ru": "Кто вице-губернатор провинции {p}?", "uk": "Хто лейтенант-губернатор провінції {p}?"}, p=P),
                           lg["name"], wrong_lg,
                           fmt({"en": "The Lieutenant Governor of {p}, who represents the Sovereign in the province, is {n}.",
                                "ru": "Вице-губернатор провинции {p} (представитель Суверена в провинции) — {n}.",
                                "uk": "Лейтенант-губернатор провінції {p} (представник Суверена в провінції) — {n}."}, p=P, n=lg_val)))
        abbr = {k: {l: k + "s" if l == "en" else k for l in LANGS} for k in MEMBERS}
        q_mem = choice_q(OLD_IDS.get((code, "members"), f"loc-{code}-members"),
                         fmt({"en": "What are the elected members of the legislature of {p} called?",
                              "ru": "Как называются депутаты законодательного собрания провинции {p}?",
                              "uk": "Як називають депутатів законодавчих зборів провінції {p}?"}, p=P),
                         abbr[p["members"]], [abbr[k] for k in MEMBERS if k != p["members"]],
                         fmt({"en": "In {p}, members of the legislature are called {m}.", "ru": "В провинции {p} — {m}.", "uk": "У провінції {p} — {m}."}, p=P, m=mem))
        qs.append(q_mem)
        qs += p.get("extraQuestions", [])
        out_prov[code] = {"code": code, "name": P, "members": p["members"], "membersLookup": p["membersLookup"], "facts": facts, "questions": qs}

    out_cities = []
    for c in src["cities"]:
        C, m = c["name"], c["mayor"]
        facts = [fact(fmt({"en": "Mayor of {c}", "ru": "{c}: мэр", "uk": "{c}: мер"}, c=C), m["value"], m["source"])]
        if "ridings" in c:
            facts += c["ridings"]
        else:
            short = provs[c["province"]]["members"]
            facts.append(fact({"en": "Your federal MP", "ru": "Ваш федеральный депутат (MP)", "uk": "Ваш федеральний депутат (MP)"},
                              {"en": "Depends on your address — find it by postal code on the Elections Canada site",
                               "ru": "Зависит от вашего адреса — найдите по почтовому индексу на сайте Elections Canada",
                               "uk": "Залежить від вашої адреси — знайдіть за поштовим індексом на сайті Elections Canada"}, src["federalLookup"]))
            facts.append(fact({"en": f"Your provincial member ({short})", "ru": f"Ваш депутат провинции ({short})", "uk": f"Ваш депутат провінції ({short})"},
                              {"en": "Depends on your address — see the list of members and ridings on the legislature’s site",
                               "ru": "Зависит от вашего адреса — смотрите список депутатов и округов на сайте законодательного собрания",
                               "uk": "Залежить від вашої адреси — дивіться список депутатів і округів на сайті законодавчих зборів"},
                              provs[c["province"]]["membersLookup"]))
        Q = qname(c)
        if "when" in m:
            question = fmt({"en": "Who was elected mayor of {c} {w}?", "ru": "Кто избран мэром города {c} {w}?", "uk": "Кого обрано мером міста {c} {w}?"}, c=Q, w=m["when"])
        else:
            question = fmt({"en": "Who is the mayor of {c}?", "ru": "Кто мэр города {c}?", "uk": "Хто мер міста {c}?"}, c=Q)
        wrong = ([m["prev"]] if "prev" in m else []) + rank(c["id"], [o["mayor"]["name"] for o in src["cities"] if o["id"] != c["id"]])
        qs = [choice_q(m.get("qid", f"loc-{c['id']}-mayor"), question, m["name"], wrong, m["value"])]
        qs += c.get("extraQuestions", [])
        out_cities.append({"id": c["id"], "province": c["province"], "name": C, "facts": facts, "questions": qs})

    out = {"checked": src["checked"], "recheckNote": src["recheckNote"], "federalLookup": src["federalLookup"],
           "national": src["national"], "provinces": out_prov, "cities": out_cities}
    ids = [q["id"] for q in out["national"]["questions"]] + [q["id"] for p in out_prov.values() for q in p["questions"]] + \
        [q["id"] for c in out_cities for q in c["questions"]]
    assert len(ids) == len(set(ids)), "duplicate question ids"
    return out


def main() -> None:
    src = json.loads((ROOT / "content" / "local.json").read_text(encoding="utf-8"))
    out = build(src)
    (ROOT / "data" / "local.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")
    n = len(out["national"]["questions"]) + sum(len(p["questions"]) for p in out["provinces"].values()) + sum(len(c["questions"]) for c in out["cities"])
    print(f"local: {len(out['provinces'])} provinces, {len(out['cities'])} cities, {n} questions")


if __name__ == "__main__":
    main()
