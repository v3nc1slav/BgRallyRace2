<?php

namespace BgRally\Admin;

use BgRally\Game\Progress;

final class LevelsPage
{
    public const SLUG = 'bgrally-levels';

    public static function register(): void
    {
        add_action('admin_post_bgr_levels_save', [self::class, 'handleSave']);
    }

    public static function render(): void
    {
        $table = Progress::table();

        echo '<div class="wrap"><h1>Нива</h1>';
        Notices::render();
        echo '<p>Колко общо опит е нужен за всяко ниво. Всяко ниво трябва да иска повече опит от предишното. При запис нивата на играчите се преизчисляват.</p>';

        printf('<form method="post" action="%s"><input type="hidden" name="action" value="bgr_levels_save">', esc_url(admin_url('admin-post.php')));
        wp_nonce_field('bgr_levels_save');
        echo '<div class="bgr-admin-grid bgr-cols-5">';

        $previous = 0;
        foreach ($table as $level => $xp) {
            printf(
                '<div class="bgr-admin-field"><label for="bgr-level-%1$d">Ниво %1$d</label><input type="number" min="1" step="1" id="bgr-level-%1$d" name="levels[%1$d]" value="%2$d"><span class="description">+%3$d от ниво %4$d</span></div>',
                $level,
                $xp,
                $xp - $previous,
                $level - 1
            );
            $previous = $xp;
        }

        echo '</div><p class="submit">';
        submit_button('Запази', 'primary', 'submit', false);
        echo ' ';
        submit_button('Върни формулата', 'secondary', 'reset', false, ['onclick' => "return confirm('Да се върнат ли стойностите по формулата?')"]);
        echo '</p></form></div>';
    }

    public static function handleSave(): void
    {
        check_admin_referer('bgr_levels_save');
        if (!current_user_can('manage_options')) {
            wp_die('Нямате права за това действие.', 403);
        }

        $redirect = admin_url('admin.php?page=' . self::SLUG);

        if (isset($_POST['reset'])) {
            delete_option(Progress::OPTION);
            Notices::flash(sprintf('Върната е формулата. Преизчислени нива на играчи: %d.', Progress::recalculate()));
            wp_safe_redirect($redirect);
            exit;
        }

        $input = (array) wp_unslash($_POST['levels'] ?? []);
        $levels = [];
        $previous = 0;
        for ($level = 2; $level <= Progress::MAX_LEVEL; $level++) {
            $xp = absint($input[$level] ?? 0);
            if ($xp <= $previous) {
                Notices::flash(sprintf('Ниво %d трябва да иска повече опит от ниво %d (%d). Нищо не е записано.', $level, $level - 1, $previous), 'error');
                wp_safe_redirect($redirect);
                exit;
            }
            $levels[$level] = $xp;
            $previous = $xp;
        }

        update_option(Progress::OPTION, $levels, false);
        Notices::flash(sprintf('Нивата са запазени. Преизчислени нива на играчи: %d.', Progress::recalculate()));
        wp_safe_redirect($redirect);
        exit;
    }
}
