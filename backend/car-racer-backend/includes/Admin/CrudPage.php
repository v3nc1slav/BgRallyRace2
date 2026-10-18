<?php

namespace BgRally\Admin;

use BgRally\Catalog\Entity;
use BgRally\Catalog\Field;

final class CrudPage
{
    private array $errors = [];
    private ?array $draft = null;

    public function __construct(private readonly Entity $entity)
    {
    }

    public function handle(): void
    {
        foreach ($this->entity->fields as $field) {
            if ($field->type === 'route') {
                $file = BGR_DIR . '/assets/route-editor.js';
                wp_enqueue_script('bgr-route-editor', plugin_dir_url(BGR_FILE) . 'assets/route-editor.js', [], file_exists($file) ? filemtime($file) : false, true);
            }
        }

        $action = sanitize_key($_REQUEST['bgr_action'] ?? '');

        if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            check_admin_referer('bgr_save_' . $this->entity->slug);
            $id = absint($_POST['id'] ?? 0);
            [$data, $errors] = $this->entity->sanitize(wp_unslash($_POST));

            if ($errors) {
                $this->errors = $errors;
                $this->draft = $data + ['id' => $id];
                return;
            }

            $this->entity->save($data, $id ?: null);
            $this->redirect('saved');
        }

        if ($action === 'delete') {
            $id = absint($_GET['id'] ?? 0);
            check_admin_referer('bgr_delete_' . $this->entity->slug . '_' . $id);

            if ($this->entity->isInUse($id)) {
                $this->redirect('in_use');
            }

            $this->entity->delete($id);
            $this->redirect('deleted');
        }

        if ($action === 'custom') {
            $key = sanitize_key($_GET['do'] ?? '');
            $id = absint($_GET['id'] ?? 0);
            check_admin_referer('bgr_' . $key . '_' . $this->entity->slug . '_' . $id);

            if (isset($this->entity->actions[$key])) {
                Notices::flash(($this->entity->actions[$key][1])($id));
            }

            wp_safe_redirect($this->url());
            exit;
        }
    }

    public function render(): void
    {
        $view = sanitize_key($_GET['view'] ?? '');
        $item = $view === 'edit' ? $this->entity->find(absint($_GET['id'] ?? 0)) : null;

        echo '<div class="wrap">';
        if ($this->draft !== null) {
            $this->renderForm($this->draft);
        } elseif ($view === 'new') {
            $this->renderForm($this->entity->defaults());
        } elseif ($item) {
            $this->renderForm($item);
        } else {
            $this->renderList();
        }
        echo '</div>';
    }

    private function url(array $args = []): string
    {
        return add_query_arg(['page' => 'bgrally-' . $this->entity->slug] + $args, admin_url('admin.php'));
    }

    private function redirect(string $message): never
    {
        wp_safe_redirect($this->url(['bgr_msg' => $message]));
        exit;
    }

    private function renderList(): void
    {
        $fields = array_filter($this->entity->fields, fn(Field $field) => $field->inList);
        $items = $this->entity->all();

        printf(
            '<h1 class="wp-heading-inline">%s</h1> <a href="%s" class="page-title-action">Добави</a><hr class="wp-header-end">',
            esc_html($this->entity->plural),
            esc_url($this->url(['view' => 'new']))
        );
        Notices::render();

        echo '<table class="widefat striped"><thead><tr>';
        foreach ($fields as $field) {
            printf('<th>%s</th>', esc_html($field->label));
        }
        echo '<th></th></tr></thead><tbody>';

        if (!$items) {
            printf('<tr><td colspan="%d">Няма записи.</td></tr>', count($fields) + 1);
        }

        foreach ($items as $item) {
            echo '<tr>';
            foreach ($fields as $field) {
                printf('<td>%s</td>', esc_html($field->display($item[$field->name])));
            }

            $edit = $this->url(['view' => 'edit', 'id' => $item['id']]);
            $delete = wp_nonce_url(
                $this->url(['bgr_action' => 'delete', 'id' => $item['id']]),
                'bgr_delete_' . $this->entity->slug . '_' . $item['id']
            );
            $links = [sprintf('<a href="%s">Редактирай</a>', esc_url($edit))];
            foreach ($this->entity->actions as $key => [$label]) {
                $url = wp_nonce_url(
                    $this->url(['bgr_action' => 'custom', 'do' => $key, 'id' => $item['id']]),
                    'bgr_' . $key . '_' . $this->entity->slug . '_' . $item['id']
                );
                $links[] = sprintf('<a href="%s">%s</a>', esc_url($url), esc_html($label));
            }
            $links[] = sprintf('<a href="%s" class="submitdelete" onclick="return confirm(\'Сигурни ли сте?\')">Изтрий</a>', esc_url($delete));

            printf('<td>%s</td>', implode(' | ', $links));
            echo '</tr>';
        }

        echo '</tbody></table>';
    }

    private function renderForm(array $item): void
    {
        $id = (int) ($item['id'] ?? 0);

        printf('<h1>%s: %s</h1>', esc_html($this->entity->plural), $id ? 'редактиране' : 'добавяне');
        printf('<p><a href="%s">&larr; Назад към списъка</a></p>', esc_url($this->url()));

        foreach ($this->errors as $error) {
            printf('<div class="notice notice-error"><p>%s</p></div>', esc_html($error));
        }

        printf('<form method="post" action="%s">', esc_url($this->url()));
        wp_nonce_field('bgr_save_' . $this->entity->slug);
        printf('<input type="hidden" name="bgr_action" value="save"><input type="hidden" name="id" value="%d">', $id);

        echo '<table class="form-table" role="presentation">';
        foreach ($this->entity->fields as $field) {
            printf(
                '<tr><th scope="row"><label for="bgr-%s">%s</label></th><td>%s</td></tr>',
                esc_attr($field->name),
                esc_html($field->label),
                $field->input($item[$field->name] ?? $field->defaultValue())
            );
        }
        echo '</table>';

        submit_button('Запази');
        echo '</form>';
    }
}
