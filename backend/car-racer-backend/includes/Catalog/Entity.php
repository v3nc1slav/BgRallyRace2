<?php

namespace BgRally\Catalog;

use BgRally\Database\Tables;
use Closure;

final class Entity
{
    /**
     * @param Field[] $fields
     * @param array<string, array{0: string, 1: callable(int): string}> $actions
     */
    public function __construct(
        public readonly string $slug,
        public readonly string $plural,
        public readonly array $fields,
        private readonly ?Closure $inUse = null,
        private readonly ?Closure $label = null,
        public readonly array $actions = [],
        private readonly string $orderBy = 'id',
    ) {
    }

    public function table(): string
    {
        return Tables::name($this->slug);
    }

    public function createTableSql(string $charset): string
    {
        $columns = '';
        foreach ($this->fields as $field) {
            $columns .= "  {$field->name} {$field->columnSql()},\n";
        }

        return "CREATE TABLE {$this->table()} (\n  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,\n{$columns}  PRIMARY KEY  (id)\n) $charset;";
    }

    public function defaults(): array
    {
        $values = [];
        foreach ($this->fields as $field) {
            $values[$field->name] = $field->defaultValue();
        }
        return $values;
    }

    /**
     * @return array{0: array<string, mixed>, 1: string[]}
     */
    public function sanitize(array $input): array
    {
        $data = [];
        $errors = [];

        foreach ($this->fields as $field) {
            $value = $field->sanitize($input[$field->name] ?? null);
            if ($field->required && $field->isEmpty($value)) {
                $errors[] = sprintf('Полето „%s“ е задължително.', $field->label);
            }
            $data[$field->name] = $value;
        }

        return [$data, $errors];
    }

    public function all(): array
    {
        global $wpdb;
        return $wpdb->get_results("SELECT * FROM {$this->table()} ORDER BY {$this->orderBy}", ARRAY_A);
    }

    public function options(): array
    {
        $options = [];
        foreach ($this->all() as $row) {
            $options[$row['id']] = $this->label ? ($this->label)($row) : (string) ($row['name'] ?? '#' . $row['id']);
        }
        return $options;
    }

    public function find(int $id): ?array
    {
        global $wpdb;
        return $wpdb->get_row($wpdb->prepare("SELECT * FROM {$this->table()} WHERE id = %d", $id), ARRAY_A);
    }

    public function save(array $data, ?int $id): int
    {
        global $wpdb;

        if ($id) {
            $wpdb->update($this->table(), $data, ['id' => $id]);
            return $id;
        }

        $wpdb->insert($this->table(), $data);
        return (int) $wpdb->insert_id;
    }

    public function isInUse(int $id): bool
    {
        return $this->inUse !== null && ($this->inUse)($id);
    }

    public function delete(int $id): void
    {
        global $wpdb;
        $wpdb->delete($this->table(), ['id' => $id]);
    }
}
