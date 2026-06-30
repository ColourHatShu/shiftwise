import { format, parseISO, isValid } from 'date-fns';

const toDate = (date: string | Date): Date => {
  if (date instanceof Date) return date;
  const parsed = parseISO(date);
  return isValid(parsed) ? parsed : new Date(date);
};

export const formatDate = (date: string | Date, fmt: string = 'dd MMM yyyy'): string => {
  try {
    const d = toDate(date);
    return isValid(d) ? format(d, fmt) : '—';
  } catch {
    return '—';
  }
};

export const formatTime = (time: string | Date, fmt: string = 'HH:mm'): string => {
  try {
    if (typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time)) {
      return time.slice(0, 5);
    }
    const d = toDate(time as string | Date);
    return isValid(d) ? format(d, fmt) : '—';
  } catch {
    return '—';
  }
};

export const formatDateTime = (date: string | Date): string =>
  `${formatDate(date)} ${formatTime(date)}`;

export const durationHours = (startTime: string, endTime: string): number => {
  const parse = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const start = parse(startTime);
  let end = parse(endTime);
  if (end <= start) end += 24 * 60; // overnight shift
  return Math.round(((end - start) / 60) * 10) / 10;
};
