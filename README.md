# canada-test

Приложение для подготовки к тесту на гражданство Канады по брошюре
«Discover Canada: The Rights and Responsibilities of Citizenship».
Две версии: **EN** — официальный оригинал, **RU** — неофициальный перевод.

**Сайт:** https://yakushenkoandrey.github.io/canada-test/

Что умеет: показывает брошюру поблочно (заголовок, фото, текст), озвучивает каждый блок
с подсветкой текущего предложения и слова, выделяет ключевые факты, режим «Только главное»,
тренировка по главам.

Сейчас: вся брошюра — 12 глав, 117 блоков, ~170 фото и карта, 732 ключевых факта, 263 вопроса (этапы 1–2 из SPEC). Требования — в [SPEC.md](SPEC.md), разбивка на главы — в [docs/STRUCTURE.md](docs/STRUCTURE.md).

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
