#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';

const [packageName, version, upstreamRef] = process.argv.slice(2);
if (!packageName || !version || !upstreamRef) {
  console.error('Usage: node scripts/audit-upstream-npm-release.mjs <package> <version> <upstream-ref>');
  process.exit(2);
}

const commandName = (command) => {
  if (process.platform !== 'win32') return command;
  if (command === 'npm') return 'npm.cmd';
  if (command === 'git' || command === 'tar') return `${command}.exe`;
  return command;
};

const run = (command, args, options = {}) => execFileSync(commandName(command), args, {
  cwd: options.cwd,
  encoding: 'utf8',
  shell: process.platform === 'win32' && command === 'npm',
  stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
  env: {
    ...process.env,
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  },
});

const parsePackFilename = (output) => {
  const start = output.indexOf('[');
  if (start < 0) {
    throw new Error(`npm pack did not return JSON: ${output}`);
  }
  const parsed = JSON.parse(output.slice(start));
  if (!Array.isArray(parsed) || !parsed[0]?.filename) {
    throw new Error(`npm pack returned unexpected JSON: ${output}`);
  }
  return parsed[0].filename;
};

const collectFiles = (root) => {
  const files = new Map();

  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }

      const path = relative(root, fullPath).replaceAll('\\', '/');
      let content = readFileSync(fullPath);

      if (path === 'package.json') {
        const manifest = JSON.parse(content.toString('utf8'));
        manifest.version = '__UPSTREAM_VERSION_NORMALIZED__';
        content = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
      } else {
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(content);
          content = Buffer.from(text.replaceAll('\r\n', '\n'));
        } catch {
          // Preserve binary files byte-for-byte.
        }
      }

      files.set(path, createHash('sha256').update(content).digest('hex'));
    }
  };

  visit(root);
  return files;
};

const workDir = mkdtempSync(join(tmpdir(), 'pw-upstream-npm-audit-'));
const sourceDir = join(workDir, 'upstream-source');
const registryPackDir = join(workDir, 'registry-pack');
const sourcePackDir = join(workDir, 'source-pack');
const registryExtractDir = join(workDir, 'registry-extract');
const sourceExtractDir = join(workDir, 'source-extract');
let worktreeAdded = false;

try {
  mkdirSync(registryPackDir, { recursive: true });
  mkdirSync(sourcePackDir, { recursive: true });
  mkdirSync(registryExtractDir, { recursive: true });
  mkdirSync(sourceExtractDir, { recursive: true });

  run('git', ['worktree', 'add', '--detach', sourceDir, upstreamRef]);
  worktreeAdded = true;

  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock'], { cwd: sourceDir });
  run('npm', ['run', 'build', '--if-present'], { cwd: sourceDir });

  const registryPackOutput = run(
    'npm',
    ['pack', `${packageName}@${version}`, '--ignore-scripts', '--json', '--pack-destination', registryPackDir],
    { capture: true },
  );
  const sourcePackOutput = run(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', sourcePackDir],
    { cwd: sourceDir, capture: true },
  );

  const registryArchive = join(registryPackDir, basename(parsePackFilename(registryPackOutput)));
  const sourceArchive = join(sourcePackDir, basename(parsePackFilename(sourcePackOutput)));

  run('tar', ['-xzf', registryArchive, '-C', registryExtractDir]);
  run('tar', ['-xzf', sourceArchive, '-C', sourceExtractDir]);

  const registryFiles = collectFiles(join(registryExtractDir, 'package'));
  const sourceFiles = collectFiles(join(sourceExtractDir, 'package'));
  const allPaths = [...new Set([...registryFiles.keys(), ...sourceFiles.keys()])].sort();
  const differences = allPaths.filter(path => registryFiles.get(path) !== sourceFiles.get(path));

  if (differences.length > 0) {
    console.error('The npm payload differs from a fresh package built from the audited upstream Git ref.');
    for (const path of differences) {
      const registryHash = registryFiles.get(path) || '<missing>';
      const sourceHash = sourceFiles.get(path) || '<missing>';
      console.error(`- ${path}: npm=${registryHash} git=${sourceHash}`);
    }
    process.exitCode = 42;
  } else {
    console.log(`Verified: ${packageName}@${version} is payload-equivalent to ${upstreamRef} after normalizing package.json version.`);
  }
} finally {
  if (worktreeAdded) {
    try {
      rmSync(join(sourceDir, 'node_modules'), { recursive: true, force: true });
      run('git', ['worktree', 'remove', '--force', sourceDir]);
    } catch (error) {
      console.error(`Warning: failed to remove temporary worktree: ${error.message}`);
    }
  }
  rmSync(workDir, { recursive: true, force: true });
}
