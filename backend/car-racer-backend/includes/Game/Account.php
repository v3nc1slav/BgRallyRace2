<?php

namespace BgRally\Game;

use BgRally\Auth\Tokens;
use BgRally\Database\Tables;
use BgRally\I18n;
use WP_Error;

final class Account
{
    public const DELETED = 'Изтрит играч';
    private const CONFIRM_WORDS = ['ИЗТРИЙ', 'DELETE'];

    public static function team(?string $stored): string
    {
        return $stored === self::DELETED ? I18n::t('server.common.deleted') : (string) $stored;
    }

    public static function delete(int $userId, string $confirm): true|WP_Error
    {
        if (!in_array(mb_strtoupper(trim($confirm)), self::CONFIRM_WORDS, true)) {
            return new WP_Error('bgr_confirm', I18n::t('server.account.confirm', ['word' => I18n::t('profile.confirmWord')]), ['status' => 400]);
        }
        if (user_can($userId, 'manage_options')) {
            return new WP_Error('bgr_admin', I18n::t('server.account.admin'), ['status' => 400]);
        }

        global $wpdb;
        $manager = $wpdb->get_row($wpdb->prepare('SELECT id FROM ' . Tables::name('managers') . ' WHERE user_id = %d', $userId), ARRAY_A);
        if ($manager) {
            self::wipe((int) $manager['id']);
        }

        Tokens::revokeAll($userId);
        $wpdb->delete(Tables::name('push_devices'), ['user_id' => $userId]);
        $wpdb->delete(Tables::name('push_queue'), ['user_id' => $userId]);
        require_once ABSPATH . 'wp-admin/includes/user.php';
        if (is_multisite()) {
            require_once ABSPATH . 'wp-admin/includes/ms.php';
            wpmu_delete_user($userId);
        } else {
            wp_delete_user($userId);
        }
        return true;
    }

    private static function wipe(int $managerId): void
    {
        global $wpdb;
        $items = Tables::name('items');
        $playerCars = Tables::name('player_cars');
        $listings = Tables::name('listings');
        $entries = Tables::name('entries');
        $rallies = Tables::name('rallies');

        foreach ($wpdb->get_results($wpdb->prepare("SELECT kind, item_id FROM $listings WHERE seller_id = %d AND status = 'active'", $managerId), ARRAY_A) as $listing) {
            if ($listing['kind'] === 'car') {
                $wpdb->delete($items, ['player_car_id' => $listing['item_id']]);
                $wpdb->delete($playerCars, ['id' => $listing['item_id']]);
            } else {
                $wpdb->delete($items, ['id' => $listing['item_id']]);
            }
        }
        $wpdb->delete($listings, ['seller_id' => $managerId]);

        $wpdb->query($wpdb->prepare("DELETE FROM $items WHERE player_car_id IN (SELECT id FROM $playerCars WHERE manager_id = %d)", $managerId));
        foreach (['items', 'staff', 'player_cars', 'ledger', 'contracts', 'inbox', 'bribes', 'mayor_requests', 'ad_views', 'loans'] as $table) {
            $wpdb->delete(Tables::name($table), ['manager_id' => $managerId]);
        }
        $wpdb->query($wpdb->prepare('DELETE FROM ' . Tables::name('sabotages') . ' WHERE manager_id = %d OR target_id = %d', $managerId, $managerId));
        $wpdb->query($wpdb->prepare('DELETE FROM ' . Tables::name('street_races') . ' WHERE challenger_id = %d OR opponent_id = %d', $managerId, $managerId));

        $wpdb->query($wpdb->prepare(
            "DELETE e FROM $entries e JOIN $rallies r ON r.id = e.rally_id WHERE e.manager_id = %d AND r.status <> 'finished'",
            $managerId
        ));
        $wpdb->update($entries, ['team_name' => self::DELETED], ['manager_id' => $managerId]);
        $wpdb->delete(Tables::name('managers'), ['id' => $managerId]);
    }
}
