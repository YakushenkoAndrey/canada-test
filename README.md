# canada-test

Приложение для подготовки к тесту на гражданство Канады по брошюре
«Discover Canada: The Rights and Responsibilities of Citizenship».
Две версии: **EN** — официальный оригинал, **RU** — неофициальный перевод.

**Сайт:** https://yakushenkoandrey.github.io/canada-test/

Что умеет: показывает брошюру поблочно (заголовок, фото, текст), озвучивает каждый блок
с подсветкой текущего предложения и слова, выделяет ключевые факты, режим «Только главное»,
тренировка по главам.

Сейчас: вся брошюра — 12 глав, 117 блоков, ~170 фото и карта, 732 ключевых факта, 263 вопроса (этапы 1–3 из SPEC): пробный экзамен 20 вопросов / 15 для сдачи / таймер 30 минут, «Мои ошибки» с интервальным повторением, история экзаменов, раздел «Мой город и провинция» — 21 город во всех 10 провинциях: мэр, премьер, вице-губернатор, столица, как найти своего депутата, и тест по выбранному городу (данные — content/local.json, вопросы генерирует tools/build_local.py; дата проверки показывается на сайте — обновлять вручную после выборов), а также этап 4: работа без интернета и установка на экран телефона (PWA, `pwa/sw.js`, иконки — `python tools/make_icons.py`), «Избранное», тёмная тема. Требования — в [SPEC.md](SPEC.md), разбивка на главы — в [docs/STRUCTURE.md](docs/STRUCTURE.md).

## Языки брошюры

EN (оригинал), RU (перевод автора), UK (машинный перевод). Список языков — `content/languages.json`; язык публикуется, когда в `content/<код>/` есть все 12 глав, а в `content/questions/<код>/` — переводы вопросов. Интерфейс: русский для RU, украинский для UK, английский для остальных (для EN — выбор в настройках: English / Русский / Українська). Строки интерфейса — в коде: `L(ru, en, uk)` из `src/langs.ts`.

## Запуск локально

Нужны Node.js 20+ и Python 3.10+.

```bash
npm install
npm run dev        # http://localhost:5173/canada-test/
npm run build      # сборка в dist/
npm run preview    # открыть собранный dist/
```

## Данные

```
content/<lang>/<chapter>.md     текст брошюры по блокам; ключевые факты: [[точный текст|тип]]
content/questions/<chapter>.txt  вопросы (EN + RU), компактный формат — описан в tools/build_data.py
content/images.json              какие фото извлекать из PDF
data/*.json                      собранные данные (генерируются, коммитятся)
public/img/                      извлечённые фото (коммитятся)
```

Пересобрать данные из исходников (PDF кладутся в `source/`, в git их нет):

```bash
pip install pymupdf
python tools/dump_pdf.py source/discover-canada-en.pdf 10 13   # текст и картинки страниц -> tools/tmp/
python tools/extract_images.py                                 # фото -> public/img/
python tools/build_data.py                                     # content/ -> data/*.json
python tools/validate.py                                       # проверка данных
```

Перед каждым пушем: `python tools/validate.py` и `npm run build`.
Каждый пуш в `main` публикуется на GitHub Pages через `.github/workflows/deploy.yml`.

## Статистика посещений

GoatCounter (без cookies, баннер согласия не нужен). Включается кодом сайта в `src/analytics.ts` (`GOATCOUNTER_CODE`), пустая строка — выключено. Считаются страницы (глава брошюры, тесты, разделы) и события: `lang/<код>`, `ui/<код>`, `city/<id>`, `exam/passed|failed|time-up`. Статистика: https://<код>.goatcounter.com

