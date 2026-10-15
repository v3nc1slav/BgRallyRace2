const container = document.getElementById('app');

const restUrl = container?.dataset.restUrl ?? '/wp-json/';
const nonce = container?.dataset.nonce ?? '';

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(restUrl + path, {
    headers: nonce ? { 'X-WP-Nonce': nonce } : {},
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json();
}
