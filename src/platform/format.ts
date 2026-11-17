const tz = { timeZone: 'America/Sao_Paulo' } as const;

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const fmtDateShort = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { ...tz, day: '2-digit', month: 'short' }).replace('.', '') : '—';

export const fmtDateTime = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { ...tz, hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtMoney = (v?: number) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** "há 2 h", "ontem", "12/03" */
export function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `há ${d} dias`;
  return fmtDate(iso);
}

export const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export const uid = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 8)}`;
