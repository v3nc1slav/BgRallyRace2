<?php

namespace BgRally\Game;

use BgRally\Catalog\Registry;
use BgRally\Catalog\Texts;
use BgRally\Database\Tables;
use BgRally\I18n;
use BgRally\Settings;
use WP_Error;

final class Training
{
    public static function cityStages(int $cityId): array
    {
        global $wpdb;
        $table = Registry::get('stages')->table();
        return $wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE city_id = %d AND active = 1 ORDER BY position, id", $cityId), ARRAY_A);
    }

    private static function stage(array $manager, int $stageId): ?array
    {
        foreach (self::cityStages((int) $manager['city_id']) as $stage) {
            if ((int) $stage['id'] === $stageId) {
                return $stage;
            }
        }
        return null;
    }

    public static function trainedToday(array $manager): bool
    {
        return $manager['training_date'] === wp_date('Y-m-d');
    }

    public static function stagesView(array $manager): array
    {
        $managerId = (int) $manager['id'];
        return array_map(fn($stage) => [
            'id' => (int) $stage['id'],
            'name' => Texts::of($stage['name']),
            'length_km' => (float) $stage['length_km'],
            'surface_label' => Labels::text('SURFACES', $stage['surface']),
            'profile_label' => Labels::text('PROFILES', $stage['profile']),
            'difficulty' => (int) $stage['difficulty'],
            'fuel' => Rallies::fuelForKm((float) $stage['length_km'], $managerId),
        ], self::cityStages((int) $manager['city_id']));
    }

    public static function view(array $manager): array
    {
        $managerId = (int) $manager['id'];
        return [
            'stages' => self::stagesView($manager),
            'weekday' => (int) date('N', Rallies::now()) <= 5,
            'trained_today' => self::trainedToday($manager),
            'energy' => Settings::int('training_energy'),
            'skill_chance' => Settings::int('training_skill_chance'),
            'risk' => Police::officialRisk($managerId),
            'fine' => Settings::int('fine_official'),
            'own' => [
                'status' => Mayor::refreshTrack($manager)['track_status'],
                'km' => Settings::get('track_km'),
                'fuel' => Rallies::fuelForKm(Settings::get('track_km'), $managerId),
            ],
        ];
    }

    private static function ownStage(): array
    {
        return [
            'id' => 0,
            'name' => I18n::t('server.training.ownStage'),
            'length_km' => Settings::get('track_km'),
            'surface' => 'asphalt',
            'profile' => 'technical',
            'difficulty' => 5,
            'turns' => 30,
        ];
    }

    public static function own(array $manager): string|WP_Error
    {
        if (Mayor::refreshTrack($manager)['track_status'] !== 'open') {
            return new WP_Error('bgr_track', I18n::t('server.training.noOwn'), ['status' => 400]);
        }
        return self::train($manager, 0, [
            'stage' => self::ownStage(),
            'energy' => Settings::int('training_energy'),
            'fuel' => true,
            'wear' => 1.0,
            'chance' => 100,
            'risk' => 0,
            'fine' => 0,
            'place' => I18n::t('server.training.placeOwn'),
            'xp' => 'xp_own',
        ]);
    }

    public static function official(array $manager, int $stageId): string|WP_Error
    {
        if ((int) date('N', Rallies::now()) > 5) {
            return new WP_Error('bgr_weekend', I18n::t('server.training.weekend'), ['status' => 400]);
        }
        return self::train($manager, $stageId, [
            'energy' => Settings::int('training_energy'),
            'fuel' => true,
            'wear' => 1.0,
            'chance' => Settings::int('training_skill_chance'),
            'risk' => Police::officialRisk((int) $manager['id']),
            'fine' => Settings::int('fine_official'),
            'place' => I18n::t('server.training.placeOfficial'),
            'xp' => 'xp_official',
        ]);
    }

    public static function black(array $manager, int $stageId): string|WP_Error
    {
        return self::train($manager, $stageId, [
            'energy' => Settings::int('black_energy'),
            'fuel' => false,
            'wear' => Settings::get('black_wear'),
            'chance' => Settings::int('black_skill_chance'),
            'risk' => Police::blackRisk((int) $manager['id']),
            'fine' => Settings::int('fine_black'),
            'place' => I18n::t('server.training.placeBlack'),
            'xp' => 'xp_black_training',
        ]);
    }

    private static function train(array $manager, int $stageId, array $rules): string|WP_Error
    {
        global $wpdb;
        $managerId = (int) $manager['id'];

        if (self::trainedToday($manager)) {
            return new WP_Error('bgr_trained', I18n::t('server.training.trained'), ['status' => 400]);
        }
        $stage = $rules['stage'] ?? self::stage($manager, $stageId);
        if (!$stage) {
            return new WP_Error('bgr_stage', I18n::t('server.training.stage'), ['status' => 400]);
        }
        $crew = Simulator::streetCrew($managerId);
        if (!$crew) {
            return new WP_Error('bgr_not_ready', I18n::t('server.black.notReady'), ['status' => 400]);
        }

        $fuel = $rules['fuel'] ? Rallies::fuelForKm((float) $stage['length_km'], $managerId) : 0;
        if ((int) $manager['money'] < $fuel) {
            return new WP_Error('bgr_money', I18n::t('server.training.fuelNeed', ['money' => I18n::money($fuel)]), ['status' => 400]);
        }
        if (!Energy::spend($managerId, $rules['energy'])) {
            return new WP_Error('bgr_energy', I18n::t('server.common.energyNeed', ['energy' => $rules['energy']]), ['status' => 400]);
        }
        if ($fuel && !Ledger::add($managerId, -$fuel, 'training', Texts::of($stage['name']))) {
            Energy::refund($managerId, $rules['energy']);
            return new WP_Error('bgr_money', I18n::t('server.training.fuel'), ['status' => 400]);
        }

        $wpdb->update(Tables::name('managers'), ['training_date' => wp_date('Y-m-d')], ['id' => $managerId]);
        Garage::applyWear(Simulator::streetWear($crew, $stage, $rules['wear']));
        $time = Simulator::stageTime($crew, $stage, 'normal', 'dry');

        $improved = [];
        foreach (['pilot', 'navigator'] as $role) {
            if (mt_rand(1, 100) <= $rules['chance']) {
                Staff::improveRole($managerId, $role, 1);
                $improved[] = mb_strtolower(Labels::text('ROLES', $role));
            }
        }

        $message = I18n::t('server.training.result', ['stage' => Texts::of($stage['name']), 'place' => $rules['place'], 'time' => Simulator::formatTime($time)]);
        $message .= ' ' . ($improved ? I18n::t('server.training.skill', ['list' => I18n::join($improved)]) : I18n::t('server.training.noSkill'));
        $message .= Progress::addDaily($managerId, $rules['xp']);

        if (Police::caught($rules['risk'])) {
            Police::fine($managerId, $rules['fine'], I18n::t('server.ledger.training', ['place' => $rules['place']]));
            $message .= ' ' . I18n::t('server.training.caught', ['money' => I18n::money($rules['fine'])]);
        }

        return $message;
    }
}
