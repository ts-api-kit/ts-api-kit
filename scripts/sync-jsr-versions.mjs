#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Syncs versions from each package.json under packages/ into its jsr.json.
 * Also updates jsr import constraints for internal packages to the bumped version.
 */

const ROOT = process.cwd();
const globs = ['packages/core', 'packages/compiler'];

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function parseSemver(v) {
  const m = /^([0-9]+)\.([0-9]+)\.([0-9]+)(?:[-+].*)?$/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function caretMinorRange(v) {
  const p = parseSemver(v);
  if (!p) return `^${v}`;
  // For 0.x.y keep ^0.minor.0 so patch bumps don't force updates
  if (p.major === 0) return `^0.${p.minor}.0`;
  return `^${p.major}.${p.minor}.0`;
}

function updateImportsForInternal(manifest, internalName, newVersion) {
  if (!manifest.imports) return false;
  let changed = false;
  for (const [key, val] of Object.entries(manifest.imports)) {
    if (typeof val === 'string' && val.startsWith(`jsr:${internalName}@`)) {
      const newRange = `jsr:${internalName}@${caretMinorRange(newVersion)}`;
      if (val !== newRange) {
        manifest.imports[key] = newRange;
        changed = true;
      }
    }
  }
  return changed;
}

let changed = false;
const checkOnly = process.argv.includes('--check');

for (const base of globs) {
  const pkgJsonPath = join(ROOT, base, 'package.json');
  if (!existsSync(pkgJsonPath)) continue;
  const jsrJsonPath = join(ROOT, base, 'jsr.json');
  const denoJsonPath = join(ROOT, base, 'deno.json');
  if (!existsSync(jsrJsonPath)) continue;

  const pkg = readJson(pkgJsonPath);
  const jsr = readJson(jsrJsonPath);
  const deno = existsSync(denoJsonPath) ? readJson(denoJsonPath) : null;

  const prev = jsr.version;
  const next = pkg.version;
  if (!next) continue;

  if (prev !== next) {
    if (!checkOnly) jsr.version = next;
    changed = true;
  }

  if (deno && deno.version !== next) {
    if (!checkOnly) deno.version = next;
    changed = true;
  }

  // Keep internal jsr imports in sync (e.g., compiler -> core)
  const internalChanged = updateImportsForInternal(
    jsr,
    '@ts-api-kit/core',
    pkg.name === '@ts-api-kit/core' ? next : readJson(join(ROOT, 'packages/core', 'package.json')).version,
  );
  if (internalChanged) changed = true;

  if (!checkOnly) {
    writeJson(jsrJsonPath, jsr);
    if (deno) writeJson(denoJsonPath, deno);
  }
}

if (checkOnly) {
  if (changed) {
    console.error('jsr.json manifests out of sync with package.json');
    process.exit(1);
  } else {
    console.log('jsr.json versions already in sync.');
  }
} else {
  if (changed) {
    console.log('Synchronized jsr.json versions to match package.json versions.');
  } else {
    console.log('jsr.json versions already in sync.');
  }
}
