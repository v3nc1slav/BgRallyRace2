<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Database\Tables;
use BgRally\Settings;
use WP_Error;

final class Market
{
    private static function table(): string
    {
        return Tables::name('listings');
    }

    private static function itemQuery(string $where): string
    {
        $items = Tables::name('items');
        $parts = Registry::get('parts')->table();
        $tyres = Registry::get('tyres')->table();

        return "SELECT i.*, COALESCE(p.name, t.name) AS name, COALESCE(p.price, t.price) AS catalog_price,
                       p.type AS part_type, p.class AS part_class, t.type AS tyre_type, t.compound
                FROM $items i
                LEFT JOIN $parts p ON i.kind = 'part' AND p.id = i.catalog_id
                LEFT JOIN $tyres t ON i.kind IN ('tyre', 'spare_tyre') AND t.id = i.catalog_id
                WHERE $where";
    }

    private static function itemPrice(array $row): int
    {
        $price = (int) $row['catalog_price'];
        return $row['kind'] === 'spare_tyre' ? (int) round($price * Settings::get('spare_tyre_price_pct') / 100) : $price;
    }

    private static function dealerValue(int $price, float $health): int
    {
        return (int) round($price * Settings::get('market_dealer_pct') / 100 * max(0, $health) / 100);
    }

    private static function itemOffer(array $row): array
    {
        $base = self::itemPrice($row);
        $label = $row['kind'] === 'part'
            ? (Labels::PART_TYPES[$row['part_type']] ?? '') . ' · ' . Labels::classLabel($row['part_class'])
            : ($row['kind'] === 'spare_tyre' ? 'Резервна гума · ' : 'Комплект гуми · ') . (Labels::TYRE_TYPES[$row['tyre_type']] ?? '') . ', ' . mb_strtolower(Labels::COMPOUNDS[$row['compound']] ?? '');

        return [
            'kind' => $row['kind'],
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'details' => [
                'label' => $label,
                'health' => round((float) $row['health'], 1),
                'max_health' => round((float) $row['max_health'], 1),
                'defect' => (bool) $row['defect'],
            ],
            'base' => $base,
            'dealer' => self::dealerValue($base, (float) $row['health']),
        ];
    }

    private static function carOffer(array $car): array
    {
        global $wpdb;
        $playerCarId = (int) $car['player_car_id'];
        $rows = $wpdb->get_results($wpdb->prepare(self::itemQuery('i.player_car_id = %d'), $playerCarId), ARRAY_A);
        $snapshot = Garage::snapshot($playerCarId);
        $health = $snapshot ? (float) $snapshot['health'] : 0;

        $base = (int) $car['price'];
        $dealer = self::dealerValue($base, $health);
        foreach ($rows as $row) {
            $base += self::itemPrice($row);
            $dealer += self::dealerValue(self::itemPrice($row), (float) $row['health']);
        }

        return [
            'kind' => 'car',
            'id' => $playerCarId,
            'name' => (string) $car['name'],
            'details' => [
                'label' => Labels::classLabel($car['class']) . ' · с монтираните части и гуми',
                'health' => round($health, 1),
                'max_health' => 100,
                'defect' => (bool) array_filter(array_column($rows, 'defect')),
            ],
            'base' => $base,
            'dealer' => $dealer,
        ];
    }

    public static function assets(int $managerId): array
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            self::itemQuery("i.manager_id = %d AND i.player_car_id = 0 AND i.kind IN ('part', 'tyre', 'spare_tyre')") . ' ORDER BY i.kind, i.id',
            $managerId
        ), ARRAY_A);
        $assets = array_map(fn($row) => self::itemOffer($row), $rows);

        $active = Garage::car($managerId);
        foreach (Garage::cars($managerId) as $car) {
            if (!$active || (int) $car['player_car_id'] !== (int) $active['player_car_id']) {
                $assets[] = self::carOffer(Garage::carById((int) $car['player_car_id']));
            }
        }
        return $assets;
    }

    public static function remove(int $managerId, array $asset): bool
    {
        global $wpdb;
        $items = Tables::name('items');

        if ($asset['kind'] === 'car') {
            if (!$wpdb->delete(Tables::name('player_cars'), ['id' => $asset['id'], 'manager_id' => $managerId])) {
                return false;
            }
            $wpdb->delete($items, ['player_car_id' => $asset['id']]);
            return true;
        }
        return (bool) $wpdb->delete($items, ['id' => $asset['id'], 'manager_id' => $managerId, 'player_car_id' => 0]);
    }

    private static function range(int $base): array
    {
        return [
            'min' => max(1, (int) ceil($base * Settings::get('market_min_pct') / 100)),
            'max' => (int) floor($base * Settings::get('market_max_pct') / 100),
        ];
    }

    private static function resolve(array $manager, string $kind, int $id): array|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        if ($kind === 'car') {
            $car = Garage::carById($id);
            if (!$car || (int) $car['manager_id'] !== $managerId) {
                return new WP_Error('bgr_not_found', 'Нямаш такава кола.', ['status' => 404]);
            }
            $active = Garage::car($managerId);
            if ($active && (int) $active['player_car_id'] === $id) {
                return new WP_Error('bgr_active', 'Колата за състезания не може да се продаде. Избери друга в гаража.', ['status' => 400]);
            }
            return self::carOffer($car);
        }

        $row = $wpdb->get_row($wpdb->prepare(
            self::itemQuery("i.id = %d AND i.manager_id = %d AND i.player_car_id = 0 AND i.kind IN ('part', 'tyre', 'spare_tyre')"),
            $id,
            $managerId
        ), ARRAY_A);
        return $row ? self::itemOffer($row) : new WP_Error('bgr_not_found', 'Нямаш такъв предмет в склада.', ['status' => 404]);
    }

    private static function canSell(array $manager): true|WP_Error
    {
        $level = Settings::int('market_sell_level');
        return (int) $manager['level'] >= $level ? true : new WP_Error('bgr_level', sprintf('Продаването е от ниво %d.', $level), ['status' => 400]);
    }

    private static function escrow(int $managerId, array $offer): bool
    {
        global $wpdb;
        $items = Tables::name('items');

        if ($offer['kind'] === 'car') {
            $moved = $wpdb->query($wpdb->prepare('UPDATE ' . Tables::name('player_cars') . ' SET manager_id = 0 WHERE id = %d AND manager_id = %d', $offer['id'], $managerId));
            if ($moved !== 1) {
                return false;
            }
            $wpdb->query($wpdb->prepare("UPDATE $items SET manager_id = 0 WHERE player_car_id = %d", $offer['id']));
            return true;
        }
        return $wpdb->query($wpdb->prepare("UPDATE $items SET manager_id = 0 WHERE id = %d AND manager_id = %d AND player_car_id = 0", $offer['id'], $managerId)) === 1;
    }

    private static function release(array $listing, int $managerId): void
    {
        global $wpdb;
        $items = Tables::name('items');

        if ($listing['kind'] === 'car') {
            $wpdb->update(Tables::name('player_cars'), ['manager_id' => $managerId], ['id' => $listing['item_id']]);
            $wpdb->query($wpdb->prepare("UPDATE $items SET manager_id = %d WHERE player_car_id = %d", $managerId, $listing['item_id']));
            return;
        }
        $wpdb->update($items, ['manager_id' => $managerId], ['id' => $listing['item_id']]);
    }

    private static function close(int $listingId, string $status, int $buyerId = 0): bool
    {
        global $wpdb;
        return $wpdb->query($wpdb->prepare(
            'UPDATE ' . self::table() . " SET status = %s, buyer_id = %d, closed_at = %s WHERE id = %d AND status = 'active'",
            $status,
            $buyerId,
            current_time('mysql'),
            $listingId
        )) === 1;
    }

    private static function find(int $listingId): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d', $listingId), ARRAY_A);
    }

    private static function delivery(array $listing, array $manager): int
    {
        if ((int) $listing['city_id'] === (int) $manager['city_id']) {
            return 0;
        }
        return (int) round(Travel::cost((int) $listing['city_id'], (int) $manager['city_id']) * Settings::get('market_delivery_pct') / 100);
    }

    public static function list(array $manager, string $kind, int $id, int $price): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        $allowed = self::canSell($manager);
        if (is_wp_error($allowed)) {
            return $allowed;
        }
        $offer = self::resolve($manager, $kind, $id);
        if (is_wp_error($offer)) {
            return $offer;
        }
        $range = self::range($offer['base']);
        if ($price < $range['min'] || $price > $range['max']) {
            return new WP_Error('bgr_price', sprintf('Цената трябва да е между %d € и %d €.', $range['min'], $range['max']), ['status' => 400]);
        }

        $energy = Settings::int('market_energy');
        if (!Energy::spend($managerId, $energy)) {
            return new WP_Error('bgr_energy', sprintf('Нямате достатъчно енергия (нужни са %d).', $energy), ['status' => 400]);
        }
        if (!self::escrow($managerId, $offer)) {
            Energy::refund($managerId, $energy);
            return new WP_Error('bgr_not_found', 'Предметът вече не е в гаража.', ['status' => 400]);
        }

        $days = Settings::int('market_days');
        $wpdb->insert(self::table(), [
            'seller_id' => $managerId,
            'city_id' => (int) $manager['city_id'],
            'kind' => $offer['kind'],
            'item_id' => $offer['id'],
            'name' => $offer['name'],
            'details' => wp_json_encode($offer['details']),
            'base_price' => $offer['base'],
            'price' => $price,
            'status' => 'active',
            'created_at' => current_time('mysql'),
            'expires_at' => date('Y-m-d H:i:s', Rallies::now() + $days * DAY_IN_SECONDS),
        ]);

        return sprintf('Обявата за „%s“ е публикувана за %d € и важи %d дни.', $offer['name'], $price, $days);
    }

    public static function cancel(array $manager, int $listingId): string|WP_Error
    {
        $listing = self::find($listingId);
        if (!$listing || (int) $listing['seller_id'] !== (int) $manager['id'] || !self::close($listingId, 'cancelled')) {
            return new WP_Error('bgr_not_found', 'Нямаш такава активна обява.', ['status' => 404]);
        }
        self::release($listing, (int) $manager['id']);
        return sprintf('Обявата за „%s“ е свалена. Предметът е обратно в гаража.', $listing['name']);
    }

    public static function buy(array $manager, int $listingId): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];
        $listing = self::find($listingId);

        if (!$listing || $listing['status'] !== 'active') {
            return new WP_Error('bgr_not_found', 'Обявата вече не е активна.', ['status' => 404]);
        }
        if ((int) $listing['seller_id'] === $managerId) {
            return new WP_Error('bgr_own', 'Това е твоя обява.', ['status' => 400]);
        }
        if (Bank::blocked($managerId)) {
            return new WP_Error('bgr_bank', Bank::BLOCKED, ['status' => 400]);
        }
        if ($listing['kind'] === 'car' && count(Garage::cars($managerId)) >= GarageLevels::carSlots((int) $manager['garage_level'])) {
            return new WP_Error('bgr_slots', 'Нямаш свободно място в гаража за още една кола.', ['status' => 400]);
        }

        $delivery = self::delivery($listing, $manager);
        $price = (int) $listing['price'];
        if (!self::close($listingId, 'sold', $managerId)) {
            return new WP_Error('bgr_sold', 'Някой друг току-що го купи.', ['status' => 400]);
        }
        if (!Ledger::add($managerId, -($price + $delivery), 'market', $listing['name'])) {
            $wpdb->update(self::table(), ['status' => 'active', 'buyer_id' => 0, 'closed_at' => null], ['id' => $listingId]);
            return new WP_Error('bgr_money', sprintf('Нямате достатъчно пари (нужни са %d €).', $price + $delivery), ['status' => 400]);
        }

        self::release($listing, $managerId);
        $sellerId = (int) $listing['seller_id'];
        $fee = (int) round($price * Settings::get('market_fee') / 100);
        Ledger::add($sellerId, $price - $fee, 'market_sale', $listing['name']);
        $sold = sprintf('Продаде „%s“ на пазара за %d € (комисиона %d €).', $listing['name'], $price, $fee);
        Inbox::add($sellerId, $sold);
        Push::notify($sellerId, 'market', 'Продадено на пазара', $sold, 'city/market');
        if ($price >= Settings::int('rumor_market_min')) {
            Rumors::about(
                $sellerId,
                '%s продаде „' . $listing['name'] . '“ на пазара за ' . $price . ' €.',
                sprintf('На пазара се продаде „%s“ за %d €.', $listing['name'], $price)
            );
        }

        return sprintf(
            'Купи „%s“ за %d €%s. %s',
            $listing['name'],
            $price,
            $delivery ? sprintf(' + %d € доставка', $delivery) : '',
            $listing['kind'] === 'car' ? 'Колата е в гаража.' : 'Ще го намериш в склада.'
        );
    }

    public static function dealer(array $manager, string $kind, int $id): string|WP_Error
    {
        $managerId = (int) $manager['id'];
        $allowed = self::canSell($manager);
        if (is_wp_error($allowed)) {
            return $allowed;
        }
        $offer = self::resolve($manager, $kind, $id);
        if (is_wp_error($offer)) {
            return $offer;
        }
        if (!self::remove($managerId, $offer)) {
            return new WP_Error('bgr_not_found', 'Предметът вече не е в гаража.', ['status' => 400]);
        }

        Ledger::add($managerId, $offer['dealer'], 'dealer', $offer['name']);
        return sprintf('Изкупвачът взе „%s“ за %d €.', $offer['name'], $offer['dealer']);
    }

    public static function expire(): void
    {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            'SELECT * FROM ' . self::table() . " WHERE status = 'active' AND expires_at <= %s LIMIT 100",
            current_time('mysql')
        ), ARRAY_A);

        foreach ($rows as $listing) {
            if (self::close((int) $listing['id'], 'expired')) {
                self::release($listing, (int) $listing['seller_id']);
                Inbox::add((int) $listing['seller_id'], sprintf('Обявата за „%s“ изтече без купувач. Предметът е обратно в гаража.', $listing['name']));
            }
        }
    }

    private static function listingView(array $row, array $manager, bool $mechanic): array
    {
        $details = json_decode((string) $row['details'], true) ?: [];
        $own = (int) $row['seller_id'] === (int) $manager['id'];
        if (!$own && !$mechanic) {
            $details['defect'] = null;
        }

        return [
            'id' => (int) $row['id'],
            'kind' => $row['kind'],
            'kind_label' => Labels::MARKET_KINDS[$row['kind']] ?? $row['kind'],
            'name' => $row['name'],
            'details' => $details,
            'base_price' => (int) $row['base_price'],
            'price' => (int) $row['price'],
            'delivery' => $own ? 0 : self::delivery($row, $manager),
            'seller' => (string) ($row['seller'] ?? ''),
            'city' => (string) ($row['city'] ?? ''),
            'expires_at' => str_replace(' ', 'T', $row['expires_at']),
        ];
    }

    public static function view(array $manager, string $scope = 'all', string $kind = ''): array
    {
        global $wpdb;
        self::expire();

        $managerId = (int) $manager['id'];
        $listings = self::table();
        $managers = Tables::name('managers');
        $cities = Registry::get('cities')->table();

        $where = ["l.status = 'active'"];
        if ($scope === 'city') {
            $where[] = $wpdb->prepare('l.city_id = %d', $manager['city_id']);
        }
        if ($kind === 'tyre') {
            $where[] = "l.kind IN ('tyre', 'spare_tyre')";
        } elseif (in_array($kind, ['part', 'car'], true)) {
            $where[] = $wpdb->prepare('l.kind = %s', $kind);
        }

        $rows = $wpdb->get_results(
            "SELECT l.*, u.display_name AS seller, c.name AS city FROM $listings l
             JOIN $managers m ON m.id = l.seller_id
             LEFT JOIN {$wpdb->users} u ON u.ID = m.user_id
             LEFT JOIN $cities c ON c.id = l.city_id
             WHERE " . implode(' AND ', $where) . ' ORDER BY l.id DESC LIMIT 100',
            ARRAY_A
        );
        $mine = $wpdb->get_results($wpdb->prepare(
            "SELECT l.*, c.name AS city FROM $listings l LEFT JOIN $cities c ON c.id = l.city_id WHERE l.seller_id = %d AND l.status = 'active' ORDER BY l.id DESC",
            $managerId
        ), ARRAY_A);

        $mechanic = Staff::member($managerId, 'mechanic') !== null;
        $others = array_values(array_filter($rows, fn($row) => (int) $row['seller_id'] !== $managerId));

        return [
            'listings' => array_map(fn($row) => self::listingView($row, $manager, $mechanic), $others),
            'mine' => array_map(fn($row) => self::listingView($row, $manager, $mechanic), $mine),
            'sellable' => array_map(fn($asset) => $asset + self::range($asset['base']), self::assets($managerId)),
            'rules' => [
                'can_sell' => (int) $manager['level'] >= Settings::int('market_sell_level'),
                'sell_level' => Settings::int('market_sell_level'),
                'energy' => Settings::int('market_energy'),
                'days' => Settings::int('market_days'),
                'fee' => Settings::int('market_fee'),
                'mechanic' => $mechanic,
                'blocked' => Bank::blocked($managerId),
            ],
        ];
    }
}
