# Тестове

Тестовете работят срещу локалния сайт в Local (`bg-race.local`) и пипат базата му директно. Всеки тест създава свои играчи и ралита и ги изтрива накрая.

```
npm test                 # тестовете на сървъра (api/) и проверка на админ страниците
npm run test:browser     # плюс тестовете в Chrome (PWA, известия)
npm test -- phase5c      # само един тест
npm run screenshots -- home,garage,city m 390   # снимки в tests/output/
```

Пътищата се откриват автоматично за Local и могат да се сменят с променливи:
- `BGR_SITE`;
- `BGR_WP_ROOT`;
- `BGR_MYSQL`;
- `BGR_PHP_DIR`;
- `BGR_CHROME`;
- `BGR_DB_HOST`, `BGR_DB_PORT`, `BGR_DB_USER`, `BGR_DB_PASSWORD`, `BGR_DB_NAME`.

Понякога Local рестартира PHP процесите след много заявки („no live upstreams“ в лога на nginx) и няколко теста падат наведнъж. Пуснете ги отново.
