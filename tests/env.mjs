import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;
const root = dirname(fileURLToPath(import.meta.url));
const services = join(env.APPDATA ?? '', 'Local', 'lightning-services');

function localService(prefix, tail) {
  try {
    const dir = readdirSync(services).filter((name) => name.startsWith(prefix)).sort().pop();
    return dir ? join(services, dir, tail) : '';
  } catch {
    return '';
  }
}

const db = {
  host: env.BGR_DB_HOST ?? '127.0.0.1',
  port: env.BGR_DB_PORT ?? '10005',
  user: env.BGR_DB_USER ?? 'root',
  password: env.BGR_DB_PASSWORD ?? 'root',
  name: env.BGR_DB_NAME ?? 'local',
};

export const SITE = (env.BGR_SITE ?? 'http://bg-race.local').replace(/\/$/, '');
export const HOST = new URL(SITE).host;
export const BASE = `${SITE}/wp-json/bgrally/v1/`;
export const WP_ROOT = env.BGR_WP_ROOT ?? join(env.USERPROFILE ?? '', 'Local Sites', 'bg-race', 'app', 'public');
export const WP_LOAD = join(WP_ROOT, 'wp-load.php').replaceAll('\\', '/');
export const MU = join(WP_ROOT, 'wp-content', 'mu-plugins');
export const MYSQL = env.BGR_MYSQL ?? localService('mysql-', join('bin', 'win64', 'bin', 'mysql.exe'));
export const PHPDIR = env.BGR_PHP_DIR ?? localService('php-8', join('bin', 'win64'));
export const PHP = join(PHPDIR, 'php.exe');
export const CHROME = env.BGR_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
export const HELPERS = join(root, 'helpers');
export const OUTPUT = join(root, 'output');

mkdirSync(OUTPUT, { recursive: true });

export const sql = (query) =>
  execFileSync(MYSQL, ['-h', db.host, '-P', db.port, '-u', db.user, `-p${db.password}`, db.name, '-N', '-e', query], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

export const php = (...args) =>
  execFileSync(PHP, [
    '-d', `extension_dir=${PHPDIR}/ext`, '-d', 'extension=mysqli', '-d', 'extension=mbstring', '-d', 'extension=openssl',
    '-d', `mysqli.default_port=${db.port}`, '-d', `mysqli.default_host=${db.host}`, ...args,
  ], { encoding: 'utf8', cwd: HELPERS, env: { ...env, BGR_WP_ROOT: WP_ROOT, BGR_HOST: HOST } });

export const settings = (values) => JSON.parse(php('set_settings.php', ...Object.entries(values).map(([key, value]) => `${key}=${value}`)));

export const option = (name, value = '') =>
  JSON.parse(php('set_option.php', name, value === null ? 'delete' : value === '' ? '' : JSON.stringify(value)) || 'null');
