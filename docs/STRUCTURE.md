# Разбивка брошюры на главы и блоки (предложение)

Источник: `source/discover-canada-en.pdf` (68 стр.) и `source/discover-canada-ru.pdf` (77 стр.).
Номер страницы (`page`) в данных — всегда **по английской брошюре**, чтобы EN и RU совпадали.

Правило: **один блок = один подзаголовок брошюры** (красный подзаголовок или врезка).
Врезки (серо-сиреневые плашки в брошюре: «Unity in Diversity», «Becoming Canadian» и т. п.) — отдельные блоки с `kind: "aside"`.
Вступление главы до первого подзаголовка — блок `kind: "intro"`.
Очень длинные разделы при необходимости делятся на 2 блока с тем же заголовком и пометкой «(продолжение)».

| # | id главы | EN / RU | стр. EN | Блоки (по подзаголовкам) | Вопросов (план) |
|---|---|---|---|---|---|
| 0 | `oath` | Understanding the Oath, Welcome! / Обращение к читателям | 2–3 | Присяга, текст присяги, приветствие | 5 |
| 1 | `applying` | Applying for Citizenship / Подача заявления | 6–7 | вступление; How to use this booklet; About the citizenship test; After the test | 10 |
| 2 | `rights` | Rights and Responsibilities of Citizenship / Права и обязанности | 8–9 | вступление (Хартия, свободы); Defending Canada; The Equality of Women and Men; Citizenship Responsibilities | 25 |
| 3 | `who-we-are` | Who We Are / Кто мы | 10–13 | вступление; Aboriginal peoples; Unity in Diversity (врезка); English and French; Becoming Canadian (врезка); Diversity in Canada | 15 |
| 4 | `history` | Canada's History / История Канады | 14–23 | ~22 блока: Aboriginal peoples; The First Europeans; Exploring a river…; Royal New France; Struggle for a continent; Province of Quebec; Tradition of accommodation; United Empire Loyalists; Beginnings of Democracy; Abolition of slavery; A growing economy; War of 1812; Rebellions 1837–38; Responsible government; Confederation; Dominion from Sea to Sea; Expansion of the Dominion; First Prime Minister; Challenge in the West; Railway; Moving westward; First World War; Women get the vote; Between the wars; D-Day; Second World War | 40 |
| 5 | `modern` | Modern Canada / Современная Канада | 24–27 | Trade and economic growth; International engagement; Canada and Quebec; A Changing Society; Arts and culture; Sports; museums | 20 |
| 6 | `government` | How Canadians Govern Themselves / Как канадцы управляют собой | 28–29 | вступление; Federal state; Parliamentary democracy; Making laws (схема); Constitutional monarchy; System of Government (схема) | 25 |
| 7 | `elections` | Federal Elections / Федеральные выборы | 30–35 | Voting; Secret ballot; After an election; Voting procedures (шаги 1–8); Other levels of government. Стр. 34–35 «How Much Do You Know…» — это бланк для заполнения, **в блоки не идёт**, из него сделаем раздел Ontario/Brantford (этап 3) | 25 |
| 8 | `justice` | The Justice System / Правосудие | 36–37 | вступление; Courts; Police; Getting legal help | 12 |
| 9 | `symbols` | Canadian Symbols / Символы Канады | 38–41 | Crown; Flags; Maple leaf; Fleur-de-lys; Coat of arms; Parliament buildings; Popular sports; Beaver; Official languages; National anthem; Order of Canada; Victoria Cross; Holidays | 30 |
| 10 | `economy` | Canada's Economy / Экономика | 42–43 | A trading nation; три типа отраслей | 10 |
| 11 | `regions` | Canada's Regions / Регионы Канады | 44–51 | вступление; Regions; National Capital; Provinces and Territories; Population; затем по блоку на каждую провинцию/территорию (13) и The Canadian Rangers | 40 |

**Не входят в блоки:** обложка, оглавление (стр. 4–5), Study Questions (стр. 52–53 — используются как подсказка для банка вопросов), For More Information (54–57), Photo Credits (58–63), Authorities (64), Notes (65), Memorable Quotes (66), задняя обложка.

Итого вопросов по плану: ~257 (требование ТЗ — не меньше 250).
