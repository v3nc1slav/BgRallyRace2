const container = document.getElementById('app');

const restUrl = container?.dataset.restUrl ?? '/wp-json/';
let nonce = container?.dataset.nonce ?? '';

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
  if (nonce) {
    headers['X-WP-Nonce'] = nonce;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(restUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => null);

  if (res.status === 403 && data?.code === 'rest_cookie_invalid_nonce' && retry) {
    nonce = '';
    return request<T>(method, path, body, false);
  }
  nonce = res.headers.get('X-WP-Nonce') ?? nonce;

  if (!res.ok) {
    throw new ApiError(data?.message ?? `Няма връзка със сървъра (${res.status}).`, res.status, data?.data?.fields ?? {});
  }
  return data as T;
}

export function apiGet<T>(path: string) {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown = {}) {
  return request<T>('POST', path, body);
}
