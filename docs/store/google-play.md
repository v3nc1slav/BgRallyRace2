# Google Play – описание на приложението

Текстовете се поставят в Play Console → Присъствие в магазина → Основно описание. Българският е основният език на описанието, а английският се добавя като превод.

Ограничения на Google Play: име до 30 знака, кратко описание до 80 знака, пълно описание до 4000 знака.

## Български (bg-BG)

**Име:** BG Rally Race

**Кратко описание:**

Рали мениджър: отбор, коли, спонсори и ралита из цяла България.

**Пълно описание:**

BG Rally Race е онлайн рали мениджър. Ти не караш колата – ти водиш отбора.

Избери град, наеми пилот и навигатор и запиши отбора за ралитата от календара. Ралитата се изчисляват на сървъра и се гледат на живо: карта на етапа, колите по трасето и хроника на всичко, което се случва – грешки, спукани гуми, повреди и катастрофи.

КАКВО ПРАВИШ
• Подготвяш колата: двигател, турбо, скоростна кутия, окачване, спирачки и шаси, плюс гуми за всяка настилка и време.
• Избираш стил за всеки етап и резервни гуми и части за ралито.
• Наемаш служители в бара: майстор, инженер, психолог, химик, информатор и дори саботьор.
• Преговаряш със спонсори, теглиш заеми от банката и търгуваш с другите играчи на пазара.
• Тренираш на официалната писта, на черната писта или на собствена писта, ако кметът я одобри.
• Работиш, обличаш се в МОЛ-а и подкупваш полицията и кмета – всяко решение има цена.

ГРАДЪТ
Шест града – София, Пловдив, Смолян, Велико Търново, Благоевград и Габрово – всеки със свои привилегии, магазин и етапи. Градът е жива карта с улици, коли и хора.

СЕЗОН И КЛАСИРАНЕ
Ралитата са всяка неделя. Точките се събират в класиране по класове, а в края на сезона има награди.

ОБЩНОСТ
Чат на града, форум и слухове в бара. Известия за старта на ралито, за резултатите и за саботаж.

Играта е безплатна. Рекламите са само по желание – гледаш реклама срещу бонус.

Играта е на български и английски.

## English (en-US)

**Name:** BG Rally Race

**Short description:**

Rally manager: build a team, tune your car and race across Bulgaria.

**Full description:**

BG Rally Race is an online rally manager. You don't drive the car – you run the team.

Choose a city, hire a driver and a co-driver and enter your team in the rallies on the calendar. Rallies are computed on the server and shown live: a stage map, the cars on the route and a chronicle of everything that happens – mistakes, punctures, failures and crashes.

WHAT YOU DO
• Prepare the car: engine, turbo, gearbox, suspension, brakes and chassis, plus tyres for every surface and weather.
• Choose a driving style for each stage and the spare tyres and parts for the rally.
• Hire staff in the bar: mechanic, engineer, psychologist, chemist, informant and even a saboteur.
• Negotiate with sponsors, take bank loans and trade with other players on the market.
• Train on the official track, on the black track or on your own track if the mayor approves it.
• Take a job, buy clothes at the mall and bribe the police and the mayor – every decision has a price.

THE CITY
Six cities – Sofia, Plovdiv, Smolyan, Veliko Tarnovo, Blagoevgrad and Gabrovo – each with its own privileges, shop and stages. The city is a living map with streets, cars and people.

SEASON AND STANDINGS
Rallies run every Sunday. Points add up in the standings for each class, and the season ends with prizes.

COMMUNITY
City chat, a forum and rumors in the bar. Notifications for the rally start, the results and sabotage.

The game is free. Ads are optional – you watch an ad for a bonus.

The game is available in Bulgarian and English.

## Връзки за формуляра

- Политика за поверителност: `/poveritelnost/` (български) и `/privacy/` (английски) на адреса на сайта. Google Play приема един адрес. Предлагам английския, защото страницата се проверява и от хора извън България.
- Изтриване на профила: `/iztrivane-na-profila/` и `/account-deletion/`.

## Снимки на екрана

Google Play иска поне 2 снимки за телефон с размер между 320 и 3840 px и съотношение до 2:1. Режимът `store` на скрипта прави снимки 1080 × 1920 px без превъртане:

```
npm run screenshots -- home,garage,city,rallies,rally,shop play-bg 540 960 bg store
npm run screenshots -- home,garage,city,rallies,rally,shop play-en 540 960 en store
```

Снимките отиват в `tests/output/` (`play-bg-*.png` и `play-en-*.png`). Българските се качват към българското описание, а английските – към английското.
