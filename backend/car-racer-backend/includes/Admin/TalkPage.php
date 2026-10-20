<?php

namespace BgRally\Admin;

use BgRally\Database\Tables;
use BgRally\Game\Chat;
use BgRally\Game\Forum;
use BgRally\Game\Managers;

final class TalkPage
{
    public const SLUG = 'bgrally-talk';
    private const MUTE_HOURS = [1 => '1 час', 24 => '1 ден', 168 => '7 дни', 720 => '30 дни'];

    public static function register(): void
    {
        foreach (['delete', 'dismiss', 'topic', 'mute', 'unmute', 'words'] as $action) {
            add_action('admin_post_bgr_talk_' . $action, [self::class, 'handle' . ucfirst($action)]);
        }
    }

    public static function form(string $action, array $fields, string $inner): string
    {
        $hidden = '';
        foreach ($fields as $name => $value) {
            $hidden .= sprintf('<input type="hidden" name="%s" value="%s">', esc_attr($name), esc_attr((string) $value));
        }
        return sprintf(
            '<form method="post" action="%s" style="display:inline-block;margin:2px 4px 2px 0"><input type="hidden" name="action" value="bgr_talk_%s">%s%s%s</form>',
            esc_url(admin_url('admin-post.php')),
            esc_attr($action),
            wp_nonce_field('bgr_talk_' . $action, '_wpnonce', true, false),
            $hidden,
            $inner
        );
    }

    public static function muteForm(int $managerId): string
    {
        $options = '';
        foreach (self::MUTE_HOURS as $hours => $label) {
            $options .= sprintf('<option value="%d">%s</option>', $hours, esc_html($label));
        }
        return self::form('mute', ['manager_id' => $managerId], '<select name="hours">' . $options . '</select> <button class="button">Заглуши</button>');
    }

    public static function mutedLabel(?string $until): string
    {
        if (!$until || strtotime($until) <= strtotime(current_time('mysql'))) {
            return '';
        }
        return sprintf('<br><small style="color:#996800">Заглушен до %s</small>', esc_html(mysql2date('d.m.Y H:i', $until)));
    }

    public static function render(): void
    {
        global $wpdb;
        $messages = Chat::table();
        $topics = Forum::table();
        $managers = Tables::name('managers');
        $cities = Tables::name('cities');
        $filter = ($_GET['filter'] ?? '') === 'all' ? 'all' : 'reported';
        $where = $filter === 'all' ? 'msg.deleted = 0' : 'msg.deleted = 0 AND msg.reports > 0';

        $rows = $wpdb->get_results(
            "SELECT msg.*, u.display_name AS author, m.muted_until, t.id AS topic_id, t.title, c.name AS city
             FROM $messages msg
             LEFT JOIN $managers m ON m.id = msg.manager_id
             LEFT JOIN {$wpdb->users} u ON u.ID = m.user_id
             LEFT JOIN $topics t ON msg.channel = CONCAT('topic-', t.id)
             LEFT JOIN $cities c ON msg.channel = CONCAT('city-', c.id)
             WHERE $where
             ORDER BY msg.reports > 0 DESC, msg.id DESC LIMIT 100",
            ARRAY_A
        );

        echo '<div class="wrap"><h1>Чат и форум</h1>';
        Notices::render();

        $base = admin_url('admin.php?page=' . self::SLUG);
        printf(
            '<ul class="subsubsub"><li><a href="%s"%s>Докладвани</a> | </li><li><a href="%s"%s>Последни 100</a></li></ul><br class="clear">',
            esc_url($base),
            $filter === 'reported' ? ' class="current"' : '',
            esc_url(add_query_arg('filter', 'all', $base)),
            $filter === 'all' ? ' class="current"' : ''
        );

        echo '<table class="widefat striped"><thead><tr><th>Дата</th><th>Къде</th><th>Автор</th><th>Съобщение</th><th>Доклади</th><th></th></tr></thead><tbody>';
        if (!$rows) {
            printf('<tr><td colspan="6">%s</td></tr>', $filter === 'all' ? 'Няма съобщения.' : 'Няма докладвани съобщения.');
        }

        foreach ($rows as $row) {
            $where = $row['topic_id'] ? 'Форум: ' . $row['title'] : 'Чат: ' . ($row['city'] ?: $row['channel']);
            $actions = self::form('delete', ['message_id' => $row['id']], '<button class="button">Изтрий</button>');
            if ((int) $row['reports']) {
                $actions .= self::form('dismiss', ['message_id' => $row['id']], '<button class="button">Не е нарушение</button>');
            }
            if ($row['topic_id']) {
                $actions .= self::form('topic', ['topic_id' => $row['topic_id']], '<button class="button">Изтрий темата</button>');
            }
            $actions .= self::muteForm((int) $row['manager_id']);

            printf(
                '<tr><td>%s</td><td>%s</td><td>%s%s</td><td>%s</td><td>%d</td><td>%s</td></tr>',
                esc_html(mysql2date('d.m.Y H:i', $row['created_at'])),
                esc_html($where),
                esc_html((string) $row['author']),
                self::mutedLabel($row['muted_until']),
                nl2br(esc_html($row['text'])),
                (int) $row['reports'],
                $actions
            );
        }
        echo '</tbody></table>';

        echo '<h2>Забранени думи</h2><p>По една на ред или разделени със запетая. В чата и форума се заменят с ***.</p>';
        echo self::form('words', [], sprintf(
            '<textarea name="words" rows="6" cols="60">%s</textarea><p><button class="button button-primary">Запази</button></p>',
            esc_textarea((string) get_option(Chat::WORDS_OPTION, ''))
        ));
        echo '</div>';
    }

    private static function guard(string $action): void
    {
        check_admin_referer('bgr_talk_' . $action);
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }
    }

    private static function back(string $message): never
    {
        $url = wp_get_referer() ?: admin_url('admin.php?page=' . self::SLUG);
        wp_safe_redirect(add_query_arg('bgr_msg', $message, remove_query_arg('bgr_msg', $url)));
        exit;
    }

    public static function handleDelete(): void
    {
        global $wpdb;
        self::guard('delete');
        $id = absint($_POST['message_id'] ?? 0);
        $channel = (string) $wpdb->get_var($wpdb->prepare('SELECT channel FROM ' . Chat::table() . ' WHERE id = %d AND deleted = 0', $id));

        if ($channel !== '') {
            $wpdb->update(Chat::table(), ['deleted' => 1], ['id' => $id]);
            if (str_starts_with($channel, 'topic-')) {
                $wpdb->query($wpdb->prepare('UPDATE ' . Forum::table() . ' SET posts = GREATEST(posts - 1, 0) WHERE id = %d', (int) substr($channel, 6)));
            }
        }
        self::back('talk_deleted');
    }

    public static function handleDismiss(): void
    {
        global $wpdb;
        self::guard('dismiss');
        $wpdb->update(Chat::table(), ['reports' => 0], ['id' => absint($_POST['message_id'] ?? 0)]);
        self::back('talk_dismissed');
    }

    public static function handleTopic(): void
    {
        global $wpdb;
        self::guard('topic');
        $id = absint($_POST['topic_id'] ?? 0);
        $wpdb->update(Forum::table(), ['deleted' => 1], ['id' => $id]);
        $wpdb->update(Chat::table(), ['deleted' => 1], ['channel' => 'topic-' . $id]);
        self::back('topic_deleted');
    }

    public static function handleMute(): void
    {
        self::guard('mute');
        $hours = absint($_POST['hours'] ?? 0);
        Managers::mute(absint($_POST['manager_id'] ?? 0), isset(self::MUTE_HOURS[$hours]) ? $hours : 24);
        self::back('muted');
    }

    public static function handleUnmute(): void
    {
        self::guard('unmute');
        Managers::unmute(absint($_POST['manager_id'] ?? 0));
        self::back('unmuted');
    }

    public static function handleWords(): void
    {
        self::guard('words');
        update_option(Chat::WORDS_OPTION, sanitize_textarea_field(wp_unslash($_POST['words'] ?? '')), false);
        self::back('words_saved');
    }
}
