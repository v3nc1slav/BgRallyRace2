const euro = new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat('bg-BG', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const day = new Intl.DateTimeFormat('bg-BG', { weekday: 'long', day: 'numeric', month: 'long' });

const short = new Intl.DateTimeFormat('bg-BG', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function stamp(iso: string) {
  return short.format(new Date(iso));
}

export function money(value: number) {
  return euro.format(value);
}

export function when(iso: string) {
  return dateTime.format(new Date(iso));
}

export function date(iso: string) {
  return day.format(new Date(iso.length === 10 ? iso + 'T12:00:00' : iso));
}

export function duration(ms: number) {
  const totalTenths = Math.round(ms / 100);
  const tenths = totalTenths % 10;
  const seconds = Math.floor(totalTenths / 10) % 60;
  const minutes = Math.floor(totalTenths / 600);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

export function gap(ms: number) {
  return ms > 0 ? `+${(ms / 1000).toFixed(1)}` : '';
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}
