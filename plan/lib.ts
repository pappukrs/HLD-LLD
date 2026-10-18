import { START, WEEKS, PHASES, type Day, type Task, type Week } from './curriculum';

const DAY_MS = 24 * 60 * 60 * 1000;
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const TOTAL_DAYS = WEEKS.length * 7;

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayIso(): string {
  const now = new Date();
  return iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function dateOf(dayNumber: number): Date {
  return new Date(parseDate(START).getTime() + (dayNumber - 1) * DAY_MS);
}

/** 1-based day number for a date; < 1 before the start, > TOTAL_DAYS after the end. */
export function dayNumberOf(date: string): number {
  return Math.round((parseDate(date).getTime() - parseDate(START).getTime()) / DAY_MS) + 1;
}

export function prettyDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export interface DayView {
  dayNumber: number;
  date: string;
  weekNumber: number;
  week: Week;
  dayName: string;
  day: Day;
}

export function viewOf(dayNumber: number): DayView {
  const weekNumber = Math.ceil(dayNumber / 7);
  const week = WEEKS[weekNumber - 1];
  const dow = (dayNumber - 1) % 7;
  return { dayNumber, date: iso(dateOf(dayNumber)), weekNumber, week, dayName: DAY_NAMES[dow], day: week.days[dow] };
}

export function minutes(day: Day): number {
  return day.tasks.reduce((s, t) => s + t.minutes, 0);
}

export function phaseLabel(week: Week): string {
  const p = PHASES[week.phase];
  return `Phase ${week.phase}: ${p.name}`;
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export type { Day, Task, Week };
