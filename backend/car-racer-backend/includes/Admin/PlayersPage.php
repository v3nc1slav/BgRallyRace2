<?php

namespace BgRally\Admin;

use BgRally\Auth\Tokens;
use BgRally\Game\Managers;

final class PlayersPage
{
    private const PER_PAGE = 20;

    public static function render(): void
    {
        $search = sanitize_text_field(wp_unslash($_GET['s'] ?? ''));
        $paged = max(1, absint($_GET['paged'] ?? 1));
        [$players, $total] = Managers::search($search, self::PER_PAGE, ($paged - 1) * self::PER_PAGE);

        echo '<div class="wrap"><h1 class="wp-heading-inline">Играчи</h1><hr class="wp-header-end">';
        Notices::render();

        printf(
            '<form method="get"><input type="hidden" name="page" value="%s"><p class="search-box"><input type="search" name="s" value="%s" placeholder="Име или имейл"> <button class="button">Търси</button></p></form>',
            esc_attr(Menu::SLUG),
            esc_attr($search)
        );

        echo '<table class="widefat striped"><thead><tr>';
        foreach (['Играч', 'Имейл', 'Град', 'Ниво', 'Пари', 'Регистриран', 'Последно влизане', 'Статус', ''] as $heading) {
            printf('<th>%s</th>', esc_html($heading));
        }
        echo '</tr></thead><tbody>';

        if (!$players) {
            echo '<tr><td colspan="9">Няма играчи.</td></tr>';
        }

        foreach ($players as $player) {
            printf(
                '<tr><td>%s</td><td>%s</td><td>%s</td><td>%d</td><td>%s €</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
                esc_html($player['user_login']),
                esc_html($player['user_email']),
                esc_html((string) $player['city']),
                (int) $player['level'],
                esc_html(number_format_i18n((int) $player['money'])),
                esc_html(get_date_from_gmt($player['created_at'], 'd.m.Y H:i')),
                esc_html($player['seen_date'] ? mysql2date('d.m.Y', $player['seen_date']) : '—'),
                self::status($player),
                self::actions($player)
            );
        }

        echo '</tbody></table>';

        $pages = (int) ceil($total / self::PER_PAGE);
        if ($pages > 1) {
            echo '<div class="tablenav"><div class="tablenav-pages">';
            echo paginate_links(['base' => add_query_arg('paged', '%#%'), 'total' => $pages, 'current' => $paged]);
            echo '</div></div>';
        }

        echo '</div>';
    }

    private static function status(array $player): string
    {
        if (!$player['banned_at']) {
            $inactive = $player['inactive_since'] ? sprintf('<span style="color:#996800">Неактивен от %s</span>', esc_html(mysql2date('d.m.Y', $player['inactive_since']))) : 'Активен';
            return $inactive . TalkPage::mutedLabel($player['muted_until']);
        }

        return sprintf(
            '<span style="color:#b32d2e">Блокиран на %s</span><br><small>%s</small>',
            esc_html(get_date_from_gmt($player['banned_at'], 'd.m.Y H:i')),
            esc_html($player['ban_reason'])
        );
    }

    private static function actions(array $player): string
    {
        $id = (int) $player['id'];
        $form = '<form method="post" action="%s"><input type="hidden" name="action" value="%s"><input type="hidden" name="manager_id" value="%d">%s%s</form>';

        if ($player['banned_at']) {
            return sprintf(
                $form,
                esc_url(admin_url('admin-post.php')),
                'bgr_unban',
                $id,
                wp_nonce_field('bgr_unban_' . $id, '_wpnonce', true, false),
                '<button class="button">Отблокирай</button>'
            );
        }

        $mute = TalkPage::mutedLabel($player['muted_until'])
            ? TalkPage::form('unmute', ['manager_id' => $id], '<button class="button">Премахни заглушаването</button>')
            : TalkPage::muteForm($id);
        $sessions = Tokens::count((int) $player['user_id']);
        if ($sessions) {
            $mute .= sprintf(
                $form,
                esc_url(admin_url('admin-post.php')),
                'bgr_revoke_tokens',
                $id,
                wp_nonce_field('bgr_revoke_tokens_' . $id, '_wpnonce', true, false),
                sprintf('<button class="button">Изход от приложението (%d)</button>', $sessions)
            );
        }

        return sprintf(
            $form,
            esc_url(admin_url('admin-post.php')),
            'bgr_ban',
            $id,
            wp_nonce_field('bgr_ban_' . $id, '_wpnonce', true, false),
            '<input type="text" name="reason" placeholder="Причина" required> <button class="button">Блокирай</button>'
        ) . $mute;
    }

    public static function handleBan(): void
    {
        $id = absint($_POST['manager_id'] ?? 0);
        check_admin_referer('bgr_ban_' . $id);
        self::authorize();

        $manager = Managers::find($id);
        if ($manager && user_can((int) $manager['user_id'], 'manage_options')) {
            self::back('cannot_ban_admin');
        }

        Managers::ban($id, sanitize_text_field(wp_unslash($_POST['reason'] ?? '')));
        self::back('banned');
    }

    public static function handleUnban(): void
    {
        $id = absint($_POST['manager_id'] ?? 0);
        check_admin_referer('bgr_unban_' . $id);
        self::authorize();

        Managers::unban($id);
        self::back('unbanned');
    }

    public static function handleRevoke(): void
    {
        $id = absint($_POST['manager_id'] ?? 0);
        check_admin_referer('bgr_revoke_tokens_' . $id);
        self::authorize();

        $manager = Managers::find($id);
        if ($manager) {
            Tokens::revokeAll((int) $manager['user_id']);
        }
        self::back('tokens_revoked');
    }

    private static function authorize(): void
    {
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }
    }

    private static function back(string $message): never
    {
        $url = wp_get_referer() ?: admin_url('admin.php?page=' . Menu::SLUG);
        wp_safe_redirect(add_query_arg('bgr_msg', $message, $url));
        exit;
    }
}
