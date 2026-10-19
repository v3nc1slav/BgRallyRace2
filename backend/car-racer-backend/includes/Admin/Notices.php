<?php

namespace BgRally\Admin;

final class Notices
{
    private const MESSAGES = [
        'saved' => ['success', 'Записано.'],
        'deleted' => ['success', 'Изтрито.'],
        'in_use' => ['error', 'Записът се използва и не може да бъде изтрит. Деактивирайте го.'],
        'banned' => ['success', 'Играчът е блокиран.'],
        'unbanned' => ['success', 'Играчът е отблокиран.'],
        'cannot_ban_admin' => ['error', 'Администратор не може да бъде блокиран.'],
        'talk_deleted' => ['success', 'Съобщението е изтрито.'],
        'talk_dismissed' => ['success', 'Докладът е отхвърлен.'],
        'topic_deleted' => ['success', 'Темата е изтрита.'],
        'muted' => ['success', 'Играчът е заглушен.'],
        'unmuted' => ['success', 'Заглушаването е премахнато.'],
        'words_saved' => ['success', 'Списъкът със забранени думи е запазен.'],
    ];

    public static function flash(string $text, string $type = 'success'): void
    {
        set_transient(self::flashKey(), [$type, $text], 60);
    }

    public static function render(): void
    {
        $flash = get_transient(self::flashKey());
        if ($flash) {
            delete_transient(self::flashKey());
            self::print(...$flash);
        }

        $key = sanitize_key($_GET['bgr_msg'] ?? '');
        if (isset(self::MESSAGES[$key])) {
            self::print(...self::MESSAGES[$key]);
        }
    }

    private static function print(string $type, string $text): void
    {
        printf('<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr($type), esc_html($text));
    }

    private static function flashKey(): string
    {
        return 'bgr_notice_' . get_current_user_id();
    }
}
