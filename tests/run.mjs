import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { php } from './env.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const groups = args.includes('--browser') ? ['api', 'browser'] : ['api'];
const only = args.filter((arg) => !arg.startsWith('--'));
let failed = 0;

for (const group of groups) {
  const files = readdirSync(join(root, group))
    .filter((file) => file.endsWith('.mjs') && file !== 'shots.mjs')
    .filter((file) => !only.length || only.includes(file.replace('.mjs', '')));
  for (const file of files) {
    const result = spawnSync(process.execPath, [join(root, group, file)], { encoding: 'utf8', cwd: root });
    const output = `${result.stdout}${result.stderr}`;
    const ok = (output.match(/^OK /gm) ?? []).length;
    const fails = output.split('\n').filter((line) => line.startsWith('FAIL') || line.startsWith('ERROR'));
    const passed = result.status === 0 && !fails.length;
    failed += passed ? 0 : 1;
    console.log(`${passed ? 'OK  ' : 'FAIL'} ${group}/${file}: ${ok} checks${fails.length ? `, ${fails.length} failed` : ''}`);
    fails.slice(0, 5).forEach((line) => console.log(`       ${line}`));
  }
}

if (!only.length) {
  for (const helper of ['admin_smoke.php', 'talk_admin.php']) {
    let output = '';
    try {
      output = php(helper);
    } catch (error) {
      output = String(error.stdout ?? error);
    }
    const broken = /Fatal error|Warning:|Notice:|Deprecated:/.test(output);
    failed += broken ? 1 : 0;
    console.log(`${broken ? 'FAIL' : 'OK  '} helpers/${helper}`);
    if (broken) {
      console.log(output.split('\n').filter((line) => /error|Warning|Notice|Deprecated/.test(line)).slice(0, 5).join('\n'));
    }
  }
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exitCode = failed ? 1 : 0;
