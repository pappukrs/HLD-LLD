// Prints today's system design tasks.
//   npm run today                 → today
//   npm run today -- 2026-11-03   → a specific date
//   npm run week                  → the whole current week
import { END, START } from '../plan/curriculum';
import { dayNumberOf, minutes, pad2, phaseLabel, prettyDate, parseDate, todayIso, TOTAL_DAYS, viewOf, type Task } from '../plan/lib';

const args = process.argv.slice(2);
const showWeek = args.includes('--week');
const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? todayIso();

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => c('1', s);
const dim = (s: string) => c('2', s);
const TRACK_COLOR: Record<string, string> = { LLD: '33', HLD: '36', REV: '35', MOCK: '31', Stretch: '2' };

let n = dayNumberOf(date);
if (n < 1) {
  console.log(`The plan starts on ${START} (in ${1 - n} day${1 - n === 1 ? '' : 's'}). Showing day 1.\n`);
  n = 1;
} else if (n > TOTAL_DAYS) {
  console.log(`The plan ended on ${END}. Showing the last day. Time to negotiate.\n`);
  n = TOTAL_DAYS;
}

function printTask(t: Task, label: string = t.track) {
  console.log(`  ${c(TRACK_COLOR[label] ?? '0', `${label.padEnd(7)}${String(t.minutes).padStart(3)} min`)}  ${bold(t.title)}`);
  console.log(`  ${' '.repeat(15)}${dim(t.todo)}`);
  t.links.forEach((l) => console.log(`  ${' '.repeat(15)}→ ${l}`));
}

function printDay(dayNumber: number) {
  const v = viewOf(dayNumber);
  console.log(`${bold(`${prettyDate(parseDate(v.date))}`)} · Day ${v.dayNumber}/${TOTAL_DAYS} · ${minutes(v.day)} min`);
  v.day.tasks.forEach((t) => printTask(t));
  if (v.day.stretch) printTask(v.day.stretch, 'Stretch');
  console.log('');
}

const v = viewOf(n);
const daysLeft = TOTAL_DAYS - n;
console.log(bold(`Week ${v.weekNumber} · ${v.week.theme}`));
console.log(dim(`${phaseLabel(v.week)} · ${daysLeft} days left until ${END}`));
console.log(dim(`Goal: ${v.week.goal}`));
console.log('');

if (showWeek) {
  for (let d = (v.weekNumber - 1) * 7 + 1; d <= v.weekNumber * 7; d++) printDay(d);
} else {
  printDay(n);
}
console.log(dim(`Tick boxes in plan/weeks/week-${pad2(v.weekNumber)}.md · Log the day with /daily`));
