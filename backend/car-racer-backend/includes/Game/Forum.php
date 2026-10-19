<?php

namespace BgRally\Game;

use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Forum
{
    private const PER_PAGE = 30;
    private const TITLE_LENGTH = 150;

    public static function table(): string
    {
        return Tables::name('topics');
    }

    private static function select(): string
    {
        global $wpdb;
        return 'SELECT t.*, u.display_name AS author FROM ' . self::table() . ' t
                JOIN ' . Tables::name('managers') . " m ON m.id = t.manager_id
                LEFT JOIN {$wpdb->users} u ON u.ID = m.user_id";
    }

    private static function topicView(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'section' => $row['section'],
            'section_label' => Labels::FORUM_SECTIONS[$row['section']] ?? $row['section'],
            'title' => $row['title'],
            'author' => $row['author'] ?: 'Отбор',
            'posts' => (int) $row['posts'],
            'last_post_at' => str_replace(' ', 'T', $row['last_post_at']),
        ];
    }

    private static function find(int $id): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare(self::select() . ' WHERE t.id = %d AND t.deleted = 0', $id), ARRAY_A);
    }

    private static function rules(array $manager): array
    {
        return [
            'can_create' => (int) $manager['level'] >= Settings::int('forum_topic_level'),
            'topic_level' => Settings::int('forum_topic_level'),
            'max_length' => Settings::int('forum_length'),
            'muted_until' => Chat::mutedUntil($manager),
        ];
    }

    public static function index(array $manager, string $section): array
    {
        global $wpdb;
        $section = isset(Labels::FORUM_SECTIONS[$section]) ? $section : '';
        $counts = $wpdb->get_results('SELECT section, COUNT(*) AS topics FROM ' . self::table() . ' WHERE deleted = 0 GROUP BY section', OBJECT_K);
        $where = 't.deleted = 0' . ($section ? $wpdb->prepare(' AND t.section = %s', $section) : '');
        $rows = $wpdb->get_results(self::select() . " WHERE $where ORDER BY t.last_post_at DESC LIMIT 50", ARRAY_A);

        return [
            'section' => $section,
            'sections' => array_map(
                fn($key, $label) => ['key' => $key, 'label' => $label, 'topics' => (int) ($counts[$key]->topics ?? 0)],
                array_keys(Labels::FORUM_SECTIONS),
                Labels::FORUM_SECTIONS
            ),
            'topics' => array_map(fn($row) => self::topicView($row), $rows),
        ] + self::rules($manager);
    }

    public static function topic(array $manager, int $id, int $page): array|WP_Error
    {
        $topic = self::find($id);
        if (!$topic) {
            return new WP_Error('bgr_not_found', 'Няма такава тема.', ['status' => 404]);
        }

        $pages = max(1, (int) ceil((int) $topic['posts'] / self::PER_PAGE));
        $page = min(max(1, $page), $pages);
        $rows = Chat::rows('topic-' . $id, 0, self::PER_PAGE, ($page - 1) * self::PER_PAGE);

        return [
            'topic' => self::topicView($topic),
            'posts' => Chat::present($rows, (int) $manager['id']),
            'page' => $page,
            'pages' => $pages,
        ] + self::rules($manager);
    }

    public static function create(array $manager, string $section, string $title, string $text): int|WP_Error
    {
        global $wpdb;

        if (!isset(Labels::FORUM_SECTIONS[$section])) {
            return new WP_Error('bgr_section', 'Няма такъв раздел.', ['status' => 400]);
        }
        if (!self::rules($manager)['can_create']) {
            return new WP_Error('bgr_level', sprintf('Нова тема се отваря от ниво %d.', Settings::int('forum_topic_level')), ['status' => 400]);
        }
        $title = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($title)));
        if ($title === '' || mb_strlen($title) > self::TITLE_LENGTH) {
            return new WP_Error('bgr_title', sprintf('Заглавието е задължително и е до %d знака.', self::TITLE_LENGTH), ['status' => 400]);
        }
        $text = Chat::prepare($manager, $text, Settings::int('forum_length'));
        if (is_wp_error($text)) {
            return $text;
        }

        $now = current_time('mysql');
        $wpdb->insert(self::table(), [
            'section' => $section,
            'manager_id' => (int) $manager['id'],
            'title' => Chat::filter($title),
            'posts' => 1,
            'last_post_at' => $now,
            'created_at' => $now,
        ]);
        $id = (int) $wpdb->insert_id;
        Chat::insert((int) $manager['id'], 'topic-' . $id, $text);

        return $id;
    }

    public static function reply(array $manager, int $topicId, string $text): string|WP_Error
    {
        global $wpdb;
        if (!self::find($topicId)) {
            return new WP_Error('bgr_not_found', 'Няма такава тема.', ['status' => 404]);
        }
        $text = Chat::prepare($manager, $text, Settings::int('forum_length'));
        if (is_wp_error($text)) {
            return $text;
        }

        Chat::insert((int) $manager['id'], 'topic-' . $topicId, $text);
        $wpdb->query($wpdb->prepare('UPDATE ' . self::table() . ' SET posts = posts + 1, last_post_at = %s WHERE id = %d', current_time('mysql'), $topicId));

        return 'Отговорът е публикуван.';
    }

    public static function lastPage(int $topicId): int
    {
        global $wpdb;
        $posts = (int) $wpdb->get_var($wpdb->prepare('SELECT posts FROM ' . self::table() . ' WHERE id = %d', $topicId));
        return max(1, (int) ceil($posts / self::PER_PAGE));
    }
}
