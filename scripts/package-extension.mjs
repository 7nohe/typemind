#!/usr/bin/env node

import { constants } from 'node:fs';
import { access, mkdir, readdir, rm } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const distDir = resolve(rootDir, 'dist');
const artifactsDir = resolve(rootDir, 'artifacts');
const artifactName = 'typemind-extension.zip';
const artifactPath = resolve(artifactsDir, artifactName);

async function main() {
  await ensureDistExists();
  await mkdir(artifactsDir, { recursive: true });
  await rm(artifactPath, { force: true });

  const entries = await listDistEntries();
  if (entries.length === 0) {
    throw new Error('dist/ is empty. Run `npm run build` before packaging.');
  }

  ensureZipAvailable();
  await zipDist(entries);

  const rel = relative(rootDir, artifactPath);
  console.log(`Created ${rel}`);
}

async function ensureDistExists() {
  try {
    await access(distDir, constants.F_OK);
  } catch {
    throw new Error('Missing dist/ directory. Run `npm run build` before packaging.');
  }
}

async function listDistEntries() {
  const dirents = await readdir(distDir);
  return dirents.filter((name) => name !== '.DS_Store');
}

function ensureZipAvailable() {
  try {
    const result = spawnSync('zip', ['-v'], { stdio: 'ignore' });
    if (result.status !== 0) {
      throw new Error('zip command returned non-zero status');
    }
  } catch (err) {
    throw new Error(
      '`zip` command not found. Install it (e.g., `sudo apt install zip` or `brew install zip`) to create the release archive.'
    );
  }
}

async function zipDist(entries) {
  const args = ['-r', artifactPath, ...entries];
  await runCommand('zip', args, distDir);
}

async function runCommand(cmd, args, cwd) {
  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    child.on('error', rejectPromise);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${cmd} exited with code ${code}`));
      }
    });
  });
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exitCode = 1;
});
