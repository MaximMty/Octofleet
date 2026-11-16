/**
 * Deterministic UTC-based date/time formatter that produces identical output
 * on Node.js SSR and in browser client hydration (preventing React 19 Hydration Errors).
 */
export function formatDateTime(isoString?: string): string {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const mins = String(d.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${mins} UTC`;
}

export function formatDateShort(isoString?: string): string {
  if (!isoString) return '—';
  return isoString.slice(0, 10);
}
