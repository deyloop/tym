import type { Color } from '../domain/models/color.model';

/** Matches the shadcn Input look for native <select> and <textarea>. */
export const fieldClass =
  'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30';

export const textareaClass = fieldClass.replace('h-9', 'min-h-24') + ' py-2';

export const labelClass = 'text-xs font-medium text-muted-foreground';

/** Full class strings (Tailwind only generates classes it can see written out). */
export const BADGE_CLASSES: Record<Color, string> = {
  gray: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
  green: 'bg-green-500/15 text-green-700 dark:text-green-300',
  amber: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300',
  purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
};

export const SWATCH_CLASSES: Record<Color, string> = {
  gray: 'bg-zinc-500',
  blue: 'bg-blue-500',
  teal: 'bg-teal-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
};

export function formatDate(date: string | null): string {
  if (!date) return '—';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function todayString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatPct(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function formatHours(value: number): string {
  return `${Math.round(value * 10) / 10}h`;
}
