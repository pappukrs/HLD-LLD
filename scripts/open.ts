// Shows a concept's files, runs its demo, and opens its visual in the browser.
//   npm run open -- H17          → paths + demo output + opens visual.html
//   npm run open -- L20 --no-browser
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONCEPTS, conceptDir } from '../plan/concepts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args.find((a) => /^[HLhl]\d\d$/.test(a))?.toUpperCase();
const concept = CONCEPTS.find((x) => x.id === id);
if (!concept) {
  console.log('Usage: npm run open -- <ID>   e.g. npm run open -- H17\n');
  CONCEPTS.forEach((x) => console.log(`  ${x.id}  ${x.title}`));
  process.exit(id ? 1 : 0);
}

const dir = conceptDir(concept);
const abs = join(ROOT, dir);
console.log(`${concept.id} · ${concept.title}\n`);
for (const f of readdirSync(abs).sort()) console.log(`  ${dir}/${f}`);

const demo = join(abs, 'demo.ts');
if (existsSync(demo)) {
  console.log(`\n--- npx tsx ${dir}/demo.ts ---\n`);
  spawnSync('npx', ['tsx', demo], { cwd: ROOT, stdio: 'inherit' });
}

const visual = join(abs, 'visual.html');
if (!args.includes('--no-browser') && existsSync(visual)) {
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(opener, [visual], { detached: true, stdio: 'ignore' }).unref();
  console.log(`\nOpened ${dir}/visual.html`);
}
