import { isApp } from './platform';

const container = document.getElementById('app');
const TOKEN_KEY = 'bgr_token';

const restUrl = (isApp ? import.meta.env.VITE_API_URL : container?.dataset.restUrl) ?? '/wp-json/';
let nonce = container?.dataset.nonce ?? '';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setToken(value: string) {
  try {
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    return;
  }
}

export class ApiError extends Error {
  status: number;
  fields: Record<string, string>;

  constructor(message: string, status: number, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export function setNonce(value: string) {
  nonce = value;
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'Няма връзка със сървъра.';
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else if (nonce) {
    headers['X-WP-Nonce'] = nonce;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(restUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: token ? 'omit' : 'same-origin',
    });
  } catch {
    throw new ApiError('Няма връзка със сървъра. Провери интернета си.', 0);
  }
  const data = await res.json().catch(() => null);

  if (res.status === 403 && data?.code === 'rest_cookie_invalid_nonce' && retry) {
    nonce = '';
    return request<T>(method, path, body, false);
  }
  nonce = res.headers.get('X-WP-Nonce') ?? nonce;

  if (!res.ok) {
    throw new ApiError(data?.message ?? failure(res.status), res.status, data?.data?.fields ?? {});
  }
  if (data === null) {
    throw new ApiError('Сървърът върна неочакван отговор.', res.status);
  }
  return data as T;
}

function failure(status: number) {
  if (status === 503) {
    return 'Играта е в поддръжка. Опитай отново след малко.';
  }
  return status >= 500 ? `Техническа грешка на сървъра (${status}).` : `Неочакван отговор от сървъра (${status}).`;
}

export function apiGet<T>(path: string) {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown = {}) {
  return request<T>('POST', path, body);
}
