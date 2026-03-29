import { format, parseISO } from 'date-fns';
export const formatDate     = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy');
export const formatDateTime = (d: string | Date) => format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy HH:mm');

// Formats a date value from chart data (handles ISO strings, plain dates, nulls)
export function formatChartDate(v: any): string {
  if (!v) return '';
  const s = String(v);
  // ISO datetime: "2026-03-28T00:00:00.000Z" → "03-28"
  if (s.includes('T')) {
    const date = new Date(s);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }
  // Plain date: "2026-03-28" → "03-28"
  if (s.length >= 10) return s.slice(5, 10);
  return s;
}

// Format month label: "2026-03" → "Mar 26"
export function formatChartMonth(v: any): string {
  if (!v) return '';
  const s = String(v);
  if (s.length >= 7) {
    const [year, month] = s.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun',
                    'Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(month)-1] || month} ${year?.slice(2)}`;
  }
  return s;
}
