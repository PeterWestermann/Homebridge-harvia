#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const [stateFile, packageName, version, gitHead, integrity, upstreamBranch, branchCommit, auditRef] = process.argv.slice(2);
if (!stateFile || !packageName || !version || !integrity || !upstreamBranch || !branchCommit || !auditRef) {
  console.error('Usage: node scripts/record-upstream-npm-release.mjs <state-file> <package> <version> <gitHead> <integrity> <upstream-branch> <branch-commit> <audit-ref>');
  process.exit(2);
}

const state = {
  package: packageName,
  version,
  gitHead: gitHead || null,
  integrity,
  upstreamBranch,
  branchCommit,
  auditRef,
  result: 'payload-equivalent-to-audited-upstream-git-ref',
  auditedAt: new Date().toISOString(),
};

mkdirSync(dirname(stateFile), { recursive: true });
writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Recorded audited upstream npm release ${packageName}@${version}.`);

