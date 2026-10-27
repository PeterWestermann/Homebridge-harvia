import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
let count = 0;
for (const file of readdirSync('.github/workflows').filter(name => /\.ya?ml$/.test(name))) {
  const workflow = readFileSync(`.github/workflows/${file}`, 'utf8');
  if (/\bgh (?:pr|issue|workflow|run)\s/.test(workflow)) {
    assert.match(workflow, /^env:\r?\n  GH_REPO: \$\{\{ github\.repository \}\}/m,
      `${file}: GitHub CLI must explicitly target the maintained fork`);
  }
  const lines = workflow.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^(\s*)run: \|\s*$/);
    if (!match) continue;
    const indent = match[1].length;
    const body = [];
    while (++i < lines.length) {
      if (lines[i].trim() && lines[i].search(/\S/) <= indent) { i -= 1; break; }
      body.push(lines[i].slice(indent + 2));
    }
    const source = body.join('\n').replace(/\$\{\{[\s\S]*?\}\}/g, 'workflow-value');
    const result = spawnSync(bash, ['-n'], {input: source, encoding: 'utf8'});
    assert.ifError(result.error);
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
    for (const heredoc of source.matchAll(/<<([A-Za-z_][A-Za-z_0-9]*)\n([\s\S]*?)\n\1(?:\n|$)/g)) {
      assert.ok(!heredoc[2].includes('`'), `${file}: backticks execute inside an unquoted heredoc`);
    }
    count += 1;
  }
}
assert.ok(count > 0);
console.log(`PASS: ${count} workflow shell blocks parse; no executable Markdown heredocs.`);
