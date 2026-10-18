<?php

namespace BgRally\Catalog;

final class Field
{
    public function __construct(
        public readonly string $name,
        public readonly string $label,
        public readonly string $type = 'text',
        public readonly bool $required = false,
        public readonly mixed $default = null,
        public readonly array $options = [],
        public readonly bool $inList = true,
        public readonly ?string $ref = null,
    ) {
    }

    public function choices(): array
    {
        return $this->ref ? Registry::get($this->ref)->options() : $this->options;
    }

    public function columnSql(): string
    {
        return match ($this->type) {
            'textarea' => 'text NULL',
            'int' => 'int(11) NOT NULL DEFAULT 0',
            'float' => 'double NOT NULL DEFAULT 0',
            'bool' => 'tinyint(1) NOT NULL DEFAULT 0',
            'select' => "varchar(50) NOT NULL DEFAULT ''",
            'ref' => 'bigint(20) unsigned NOT NULL DEFAULT 0',
            'refs', 'multi' => "varchar(255) NOT NULL DEFAULT ''",
            'datetime' => 'datetime DEFAULT NULL',
            'route' => 'longtext NULL',
            default => "varchar(191) NOT NULL DEFAULT ''",
        };
    }

    public static function sanitizeRoute(mixed $raw): string
    {
        $data = is_array($raw) ? $raw : json_decode((string) $raw, true);
        if (!is_array($data)) {
            return '';
        }

        $unit = fn($value) => round(min(1, max(0, (float) $value)), 4);
        $polyline = function ($list, int $limit) use ($unit) {
            $result = [];
            foreach ((array) $list as $point) {
                if (is_array($point) && count($point) >= 2) {
                    $result[] = [$unit($point[0]), $unit($point[1])];
                }
            }
            return array_slice($result, 0, $limit);
        };

        $points = $polyline($data['points'] ?? [], 400);
        if (count($points) < 2) {
            return '';
        }

        $zones = [];
        foreach ((array) ($data['zones'] ?? []) as $zone) {
            $zonePoints = $polyline($zone['points'] ?? [], 200);
            if (in_array($zone['type'] ?? '', ['forest', 'meadow', 'field', 'water', 'village'], true) && count($zonePoints) >= 3) {
                $zones[] = ['type' => $zone['type'], 'points' => $zonePoints];
            }
        }

        $rivers = [];
        foreach ((array) ($data['rivers'] ?? []) as $river) {
            $riverPoints = $polyline($river['points'] ?? [], 200);
            if (count($riverPoints) >= 2) {
                $rivers[] = ['points' => $riverPoints];
            }
        }

        $pois = [];
        foreach ((array) ($data['pois'] ?? []) as $poi) {
            if (in_array($poi['type'] ?? '', ['bridge', 'jump', 'spectators'], true)) {
                $pois[] = ['type' => $poi['type'], 'x' => $unit($poi['x'] ?? 0), 'y' => $unit($poi['y'] ?? 0)];
            }
        }

        $labels = [];
        foreach ((array) ($data['labels'] ?? []) as $label) {
            $name = sanitize_text_field((string) ($label['name'] ?? ''));
            if ($name !== '') {
                $labels[] = ['name' => mb_substr($name, 0, 40), 'x' => $unit($label['x'] ?? 0), 'y' => $unit($label['y'] ?? 0)];
            }
        }

        $aspect = (float) ($data['aspect'] ?? 16 / 9);
        return wp_json_encode([
            'aspect' => round(min(4, max(0.25, $aspect)), 4),
            'points' => $points,
            'labels' => array_slice($labels, 0, 60),
            'zones' => array_slice($zones, 0, 80),
            'rivers' => array_slice($rivers, 0, 20),
            'pois' => array_slice($pois, 0, 60),
        ]);
    }

    public function defaultValue(): mixed
    {
        return $this->default ?? match ($this->type) {
            'int', 'float', 'bool', 'ref' => 0,
            'select' => (string) array_key_first($this->options),
            'datetime' => null,
            default => '',
        };
    }

    public function sanitize(mixed $raw): mixed
    {
        switch ($this->type) {
            case 'textarea':
                return sanitize_textarea_field((string) $raw);
            case 'int':
                return (int) $raw;
            case 'float':
                return (float) str_replace(',', '.', (string) $raw);
            case 'bool':
                return empty($raw) ? 0 : 1;
            case 'select':
                return array_key_exists((string) $raw, $this->options) ? (string) $raw : $this->defaultValue();
            case 'ref':
                return absint($raw);
            case 'refs':
                return implode(',', array_filter(array_map('absint', (array) $raw)));
            case 'multi':
                return implode(',', array_intersect(array_map('strval', (array) $raw), array_map('strval', array_keys($this->options))));
            case 'datetime':
                $date = \DateTime::createFromFormat('Y-m-d\TH:i', (string) $raw)
                    ?: \DateTime::createFromFormat('Y-m-d H:i:s', (string) $raw);
                return $date ? $date->format('Y-m-d H:i:00') : null;
            case 'route':
                return self::sanitizeRoute($raw);
            default:
                return sanitize_text_field((string) $raw);
        }
    }

    public function isEmpty(mixed $value): bool
    {
        return $value === null || $value === '' || ($this->type === 'ref' && (int) $value === 0);
    }

    public function display(mixed $value): string
    {
        switch ($this->type) {
            case 'bool':
                return $value ? 'Да' : 'Не';
            case 'select':
            case 'ref':
                return (string) ($this->choices()[$value] ?? '—');
            case 'refs':
            case 'multi':
                $choices = $this->choices();
                $names = array_map(fn($id) => $choices[$id] ?? '#' . $id, array_filter(explode(',', (string) $value)));
                return implode(', ', $names);
            case 'datetime':
                return $value ? mysql2date('d.m.Y H:i', $value) : '—';
            case 'route':
                $route = json_decode((string) $value, true);
                return $route ? sprintf('%d точки', count($route['points'] ?? [])) : 'генериран';
            default:
                return (string) $value;
        }
    }

    public function input(mixed $value): string
    {
        $id = 'bgr-' . $this->name;
        $name = esc_attr($this->name);
        $required = $this->required ? ' required' : '';

        switch ($this->type) {
            case 'textarea':
                return sprintf('<textarea id="%s" name="%s" rows="4" class="large-text"%s>%s</textarea>', $id, $name, $required, esc_textarea((string) $value));
            case 'int':
            case 'float':
                $step = $this->type === 'int' ? '1' : 'any';
                return sprintf('<input type="number" step="%s" id="%s" name="%s" value="%s" class="regular-text"%s>', $step, $id, $name, esc_attr((string) $value), $required);
            case 'bool':
                return sprintf('<input type="checkbox" id="%s" name="%s" value="1"%s>', $id, $name, checked((bool) $value, true, false));
            case 'select':
            case 'ref':
                $options = $this->type === 'ref' ? '<option value="0">— изберете —</option>' : '';
                foreach ($this->choices() as $key => $label) {
                    $options .= sprintf('<option value="%s"%s>%s</option>', esc_attr((string) $key), selected((string) $value, (string) $key, false), esc_html($label));
                }
                return sprintf('<select id="%s" name="%s"%s>%s</select>', $id, $name, $required, $options);
            case 'refs':
            case 'multi':
                $selected = array_filter(explode(',', (string) $value));
                $boxes = '';
                foreach ($this->choices() as $key => $label) {
                    $boxes .= sprintf(
                        '<label style="display:block"><input type="checkbox" name="%s[]" value="%s"%s> %s</label>',
                        $name,
                        esc_attr((string) $key),
                        checked(in_array((string) $key, $selected, true), true, false),
                        esc_html($label)
                    );
                }
                return sprintf('<div id="%s" style="max-height:240px;overflow:auto;border:1px solid #c3c4c7;padding:8px;background:#fff">%s</div>', $id, $boxes ?: 'Няма записи.');
            case 'datetime':
                $formatted = $value ? mysql2date('Y-m-d\TH:i', $value) : '';
                return sprintf('<input type="datetime-local" id="%s" name="%s" value="%s"%s>', $id, $name, esc_attr($formatted), $required);
            case 'route':
                return sprintf(
                    '<div class="bgr-route-editor" id="%1$s">
                        <p><label>Подложка: <input type="file" accept="image/*"></label> <span class="description">Снимката е само за чертане и не се записва никъде.</span></p>
                        <p class="bgr-route-tools">
                            <button type="button" class="button button-primary" data-mode="point">Път</button>
                            <button type="button" class="button" data-mode="label">Надписи</button>
                            <select data-role="zone-type">
                                <option value="forest">Гора</option>
                                <option value="meadow">Поляна</option>
                                <option value="field">Нива</option>
                                <option value="water">Вода</option>
                                <option value="village">Село</option>
                            </select>
                            <button type="button" class="button" data-mode="zone">Зона</button>
                            <button type="button" class="button" data-mode="river">Река</button>
                            <select data-role="poi-type">
                                <option value="spectators">Публика</option>
                                <option value="bridge">Мост</option>
                                <option value="jump">Скок</option>
                            </select>
                            <button type="button" class="button" data-mode="poi">Обекти</button>
                        </p>
                        <p class="bgr-route-tools">
                            <button type="button" class="button" data-action="finish">Затвори зоната / реката</button>
                            <button type="button" class="button" data-action="undo">Махни последната точка от пътя</button>
                            <button type="button" class="button" data-action="clear">Изчисти всичко</button>
                            <span class="bgr-route-count"></span>
                        </p>
                        <canvas style="max-width:100%%;border:1px solid #c3c4c7;background:#f0f0f1;cursor:crosshair"></canvas>
                        <p class="description">
                            Път: кликай от старта към финала, влачи точка, за да я преместиш.
                            Зона и река: кликай по контура и натисни „Затвори“ (или двоен клик). Горите се пълнят с дървета, селата с къщи.
                            Десен клик трие точка, надпис, обект, зона или река. Без маршрут играта генерира картата сама.
                        </p>
                        <textarea name="%2$s" hidden>%3$s</textarea>
                    </div>',
                    $id,
                    $name,
                    esc_textarea((string) $value)
                );
            default:
                return sprintf('<input type="text" id="%s" name="%s" value="%s" class="regular-text"%s>', $id, $name, esc_attr((string) $value), $required);
        }
    }
}
