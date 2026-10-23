<?php

namespace BgRally;

final class Frontend
{
    private const GAME_URL = 'bgr_game_url';
    private static bool $game = false;

    public static function register(): void
    {
        add_shortcode('car_racer', [self::class, 'shortcode']);
        add_filter('script_loader_tag', [self::class, 'moduleTag'], 10, 2);
        add_action('init', [self::class, 'serve'], 1);
        add_action('wp_head', [self::class, 'head'], 2);
    }

    public static function shortcode(): string
    {
        $url = plugin_dir_url(BGR_FILE) . 'game/';
        $bundle = self::bundle();

        wp_enqueue_script('car-racer', $url . $bundle['js'], [], null, true);
        foreach ($bundle['css'] as $index => $css) {
            wp_enqueue_style('car-racer' . ($index ? '-' . $index : ''), $url . $css, [], null);
        }
        add_filter('body_class', [self::class, 'bodyClass']);
        self::$game = true;
        self::rememberUrl();

        return sprintf(
            '<div id="app" data-rest-url="%s" data-nonce="%s" data-sw="%s" data-scope="%s"></div>',
            esc_url(rest_url()),
            esc_attr(wp_create_nonce('wp_rest')),
            esc_url(home_url('/?bgr_sw=1')),
            esc_attr(self::scope())
        );
    }

    public static function gameUrl(): string
    {
        return (string) (get_option(self::GAME_URL) ?: home_url('/'));
    }

    private static function scope(): string
    {
        return trailingslashit((string) (wp_parse_url(home_url('/'), PHP_URL_PATH) ?: '/'));
    }

    private static function rememberUrl(): void
    {
        $url = set_url_scheme('http://' . ($_SERVER['HTTP_HOST'] ?? '') . strtok((string) ($_SERVER['REQUEST_URI'] ?? '/'), '?'));
        if (get_option(self::GAME_URL) !== $url) {
            update_option(self::GAME_URL, $url, false);
        }
    }

    public static function head(): void
    {
        if (!self::$game) {
            return;
        }
        printf('<link rel="manifest" href="%s">' . "\n", esc_url(rest_url('bgrally/v1/manifest')));
        printf('<link rel="apple-touch-icon" href="%s">' . "\n", esc_url(plugins_url('assets/icon-192.png', BGR_FILE)));
        echo '<meta name="theme-color" content="#15171c">' . "\n";
        echo '<meta name="mobile-web-app-capable" content="yes">' . "\n";
        echo '<meta name="apple-mobile-web-app-capable" content="yes">' . "\n";
        echo '<meta name="apple-mobile-web-app-title" content="BG Rally">' . "\n";
    }

    public static function manifest(): array
    {
        $icon = fn(string $file, int $size, string $purpose = 'any') => [
            'src' => plugins_url('assets/' . $file, BGR_FILE),
            'sizes' => "{$size}x{$size}",
            'type' => 'image/png',
            'purpose' => $purpose,
        ];

        return [
            'name' => 'BG Rally Race',
            'short_name' => 'BG Rally',
            'description' => I18n::t('server.manifest.description', [], I18n::browser()),
            'lang' => I18n::browser(),
            'start_url' => self::gameUrl(),
            'scope' => home_url(self::scope()),
            'display' => 'standalone',
            'background_color' => '#15171c',
            'theme_color' => '#15171c',
            'icons' => [$icon('icon-192.png', 192), $icon('icon-512.png', 512), $icon('icon-maskable-512.png', 512, 'maskable')],
        ];
    }

    public static function serve(): void
    {
        if (isset($_GET['bgr_sw'])) {
            self::serviceWorker();
        }
        if (isset($_GET['bgr_offline'])) {
            header('Content-Type: text/html; charset=utf-8');
            echo Dropins::html('offline', I18n::browser());
            exit;
        }
    }

    private static function serviceWorker(): never
    {
        header('Content-Type: application/javascript; charset=utf-8');
        header('Cache-Control: no-cache');
        header('Service-Worker-Allowed: ' . self::scope());

        $offline = wp_json_encode(home_url('/?bgr_offline=1'));
        $image = wp_json_encode(plugins_url('assets/error.jpg', BGR_FILE));
        $cache = wp_json_encode('bgr-offline-' . BGR_VERSION . '-' . filemtime(BGR_DIR . '/dropins/error-page.tpl') . '-' . filemtime(BGR_DIR . '/assets/error.jpg'));
        $icon = wp_json_encode(plugins_url('assets/icon-192.png', BGR_FILE));
        $start = wp_json_encode(self::gameUrl());

        echo <<<JS
const CACHE = {$cache};
const OFFLINE = {$offline};
const IMAGE = {$image};
const ICON = {$icon};
const START = {$start};

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }
  const note = payload.notification || {};
  const data = payload.data || {};
  event.waitUntil(self.registration.showNotification(note.title || 'BG Rally', {
    body: note.body || '',
    icon: ICON,
    badge: ICON,
    data: { url: data.url || START },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || START;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE, IMAGE])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('bgr-offline-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const path = new URL(request.url).pathname;
  if (request.mode === 'navigate' && !path.includes('/wp-admin') && !path.includes('wp-login')) {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
  } else if (request.url === IMAGE) {
    event.respondWith(caches.match(IMAGE).then((cached) => cached || fetch(request)));
  }
});
JS;
        exit;
    }

    private static function bundle(): array
    {
        $file = BGR_DIR . '/game/.vite/manifest.json';
        $manifest = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        foreach ((array) $manifest as $chunk) {
            if (!empty($chunk['isEntry'])) {
                return ['js' => $chunk['file'], 'css' => $chunk['css'] ?? []];
            }
        }
        return ['js' => 'game.js', 'css' => ['game.css']];
    }

    public static function bodyClass(array $classes): array
    {
        $classes[] = 'bgr-game';
        return $classes;
    }

    public static function moduleTag(string $tag, string $handle): string
    {
        if ($handle === 'car-racer') {
            return str_replace('<script ', '<script type="module" ', $tag);
        }
        return $tag;
    }
}
