import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { findPackageJSON } from 'node:module';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { platform, teams } from '../stacks/stacks.mjs';

function copyBundledPackage(name, parent, destination) {
  const manifestPath = realpathSync(findPackageJSON(name, parent));
  const directory = resolve(destination, 'node_modules', name);
  cpSync(dirname(manifestPath), directory, {
    recursive: true,
    filter: path => basename(path) !== 'node_modules',
  });
  const dependencies = JSON.parse(readFileSync(manifestPath, 'utf8')).dependencies ?? {};
  for (const dependency of Object.keys(dependencies)) {
    copyBundledPackage(dependency, pathToFileURL(manifestPath), directory);
  }
}

const target = platform('a21');
const requested = process.argv[2];
if (requested && !teams.includes(requested)) throw new Error('Choose activity or sales-chart.');
console.log('\nPartial library delivery · Angular ' + target.shared['@angular/core']);
for (const team of requested ? [requested] : teams) {
  execFileSync('node', ['node_modules/@angular/cli/bin/ng.js', 'build', team], { stdio: 'inherit' });

  const directory = resolve('dist/partial', team);
  const manifestPath = resolve(directory, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.demo.producerAngular = target.shared['@angular/core'];
  manifest.files = ['fesm2022/*.mjs', 'types/**/*.d.ts'];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  if (manifest.bundledDependencies?.length) {
    rmSync(resolve(directory, 'node_modules'), { recursive: true, force: true });
    for (const name of manifest.bundledDependencies) copyBundledPackage(name, import.meta.url, directory);
  }
  mkdirSync('artifacts/partial', { recursive: true });
  execFileSync('npm', ['pack', '--silent', '--pack-destination', resolve('artifacts/partial'), '--cache', resolve('.stage/npm-cache')], {
    cwd: directory, stdio: 'inherit',
  });
  const archive = manifest.name.replace(/^@/, '').replace('/', '-') + '-' + manifest.version + '.tgz';
  writeFileSync(resolve('artifacts/partial', team + '.json'), JSON.stringify({ archive }) + '\n');
  const bytes = readFileSync(resolve('artifacts/partial', archive));
  console.log('  Partial-Ivy   ɵɵngDeclareComponent');
  console.log('  Team archive  artifacts/partial/' + archive);
  console.log('  SHA-256       ' + createHash('sha256').update(bytes).digest('hex'));
}
