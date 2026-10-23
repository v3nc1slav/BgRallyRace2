<?php

namespace BgRally;

final class Pages
{
    private const OPTION = 'bgr_pages';

    public static function ensure(): void
    {
        if (!did_action('init')) {
            add_action('init', [self::class, 'ensure']);
            return;
        }
        $pages = (array) get_option(self::OPTION, []);
        foreach (self::definitions() as $key => [$title, $slug, $content]) {
            if (!empty($pages[$key]) && get_post_status((int) $pages[$key])) {
                continue;
            }
            $existing = get_page_by_path($slug);
            if ($existing) {
                $pages[$key] = (int) $existing->ID;
                continue;
            }
            $id = wp_insert_post([
                'post_type' => 'page',
                'post_status' => 'publish',
                'post_title' => $title,
                'post_name' => $slug,
                'post_content' => $content,
            ]);
            if ($id && !is_wp_error($id)) {
                $pages[$key] = (int) $id;
            }
        }
        update_option(self::OPTION, $pages, false);
        if (!empty($pages['privacy'])) {
            update_option('wp_page_for_privacy_policy', (int) $pages['privacy']);
        }
    }

    public static function links(): array
    {
        $pages = (array) get_option(self::OPTION, []);
        $suffix = I18n::lang() === I18n::DEFAULT ? '' : '_' . I18n::lang();
        $link = function (string $key) use ($pages, $suffix) {
            $id = (int) ($pages[$key . $suffix] ?? $pages[$key] ?? 0);
            return $id ? (get_permalink($id) ?: null) : null;
        };
        return ['privacy' => $link('privacy'), 'deletion' => $link('deletion')];
    }

    private static function definitions(): array
    {
        return [
            'privacy' => ['Политика за поверителност', 'poveritelnost', self::privacy()],
            'deletion' => ['Изтриване на профила', 'iztrivane-na-profila', self::deletion()],
            'privacy_en' => ['Privacy Policy', 'privacy', self::privacyEn()],
            'deletion_en' => ['Account deletion', 'account-deletion', self::deletionEn()],
        ];
    }

    private static function privacyEn(): string
    {
        return <<<'HTML'
<p><strong>Last updated:</strong> [DATE]</p>
<h2>Who processes the data</h2>
<p>The BG Rally Race game is run by [NAME OR COMPANY], [ADDRESS]. For questions about personal data, write to [CONTACT EMAIL].</p>
<h2>What data we collect</h2>
<ul>
<li>Username, email and password (the password is only stored encrypted).</li>
<li>When you log in with Google or Facebook: the name, email and profile ID that the provider gives us.</li>
<li>Game data: team, cars, staff, standings, chat and forum messages.</li>
<li>Technical data: IP address, device and browser type, date and time of actions.</li>
<li>Cookies and local storage needed for logging in and for the game settings.</li>
</ul>
<h2>What we use it for</h2>
<ul>
<li>To run the profile and the game, including the standings and communication between players.</li>
<li>To protect against abuse and fraud.</li>
<li>For rewarded ads that the player starts on their own. Google's ad networks (Ad Manager and AdMob) may use advertising IDs and cookies according to the choice made in the consent window.</li>
</ul>
<h2>How long we keep it</h2>
<p>For as long as the profile exists. When the profile is deleted, the data is erased, except chat and forum messages and rally results, which stay anonymous as “Deleted player”.</p>
<h2>Your rights</h2>
<p>You have the right to access, correct and delete your data and to restrict its processing, as well as the right to object and to data portability. You can file a complaint with the Bulgarian Commission for Personal Data Protection (www.cpdp.bg).</p>
<h2>Children</h2>
<p>The game is not intended for children under 14.</p>
<h2>Deleting the profile</h2>
<p>The profile is deleted from the game: Profile → Delete profile. More information is on the “Account deletion” page.</p>
HTML;
    }

    private static function deletionEn(): string
    {
        return <<<'HTML'
<h2>How to delete your profile</h2>
<ol>
<li>Log in to the game (in the browser or in the app).</li>
<li>Open “Profile” from the top menu.</li>
<li>Press “Delete profile” and confirm by typing DELETE.</li>
</ol>
<p>If you cannot log in, write to us at [CONTACT EMAIL] from the profile's email address and we will delete it within 30 days.</p>
<h2>What is deleted</h2>
<p>The profile and the login (including the link to Google or Facebook), the team, cars, parts, staff, money, contracts, loans, listings and news.</p>
<h2>What stays</h2>
<p>Chat and forum messages and past rally results stay, but “Deleted player” is shown instead of your name.</p>
HTML;
    }

    private static function privacy(): string
    {
        return <<<'HTML'
<p><strong>Последна промяна:</strong> [ДАТА]</p>
<h2>Кой обработва данните</h2>
<p>Играта BG Rally Race се поддържа от [ИМЕ ИЛИ ФИРМА], [АДРЕС]. За въпроси относно личните данни пишете на [ИМЕЙЛ ЗА КОНТАКТ].</p>
<h2>Какви данни събираме</h2>
<ul>
<li>Потребителско име, имейл и парола (паролата се пази само криптирана).</li>
<li>При вход с Google или Facebook: името, имейла и идентификатора на профила, които доставчикът ни предоставя.</li>
<li>Данните от играта: отбор, коли, служители, класирания, съобщения в чата и форума.</li>
<li>Технически данни: IP адрес, тип устройство и браузър, дата и час на действията.</li>
<li>Бисквитки и локално хранилище, нужни за вход и за настройките на играта.</li>
</ul>
<h2>За какво ги използваме</h2>
<ul>
<li>За да работи профилът и играта, включително класиранията и комуникацията между играчите.</li>
<li>За защита от злоупотреби и измами.</li>
<li>За реклами с награда, които играчът пуска сам. Рекламните мрежи на Google (Ad Manager и AdMob) могат да използват рекламни идентификатори и бисквитки според избора в прозореца за съгласие.</li>
</ul>
<h2>Колко дълго ги пазим</h2>
<p>Докато профилът съществува. След изтриване на профила данните се заличават, освен съобщенията в чата и форума и резултатите от ралита, които остават анонимни като „Изтрит играч“.</p>
<h2>Вашите права</h2>
<p>Имате право на достъп, поправка, изтриване и ограничаване на обработката, както и на възражение и преносимост на данните. Можете да подадете жалба до Комисията за защита на личните данни (www.cpdp.bg).</p>
<h2>Деца</h2>
<p>Играта не е предназначена за деца под 14 години.</p>
<h2>Изтриване на профила</h2>
<p>Профилът се изтрива от играта: Профил → Изтрий профила. Повече информация има на страницата „Изтриване на профила“.</p>
HTML;
    }

    private static function deletion(): string
    {
        return <<<'HTML'
<h2>Как да изтриете профила си</h2>
<ol>
<li>Влезте в играта (в браузъра или в приложението).</li>
<li>Отворете „Профил“ от горното меню.</li>
<li>Натиснете „Изтрий профила“ и потвърдете, като напишете ИЗТРИЙ.</li>
</ol>
<p>Ако не можете да влезете, пишете ни на [ИМЕЙЛ ЗА КОНТАКТ] от имейла на профила и ще го изтрием до 30 дни.</p>
<h2>Какво се изтрива</h2>
<p>Профилът и входът (включително връзката с Google или Facebook), отборът, колите, частите, служителите, парите, договорите, заемите, обявите и новините.</p>
<h2>Какво остава</h2>
<p>Съобщенията в чата и форума и резултатите от минали ралита остават, но вместо името ви се показва „Изтрит играч“.</p>
HTML;
    }
}
