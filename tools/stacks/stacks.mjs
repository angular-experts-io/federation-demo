import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sharedEntries from './shared-runtime.json' with { type: 'json' };

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const hostPort = 4720;
export const teams = ['activity', 'sales-chart'];
export const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
export const writeJson = (file, value) => writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export function platform(release) {
  if (!['a21', 'a22'].includes(release)) throw new Error('Choose stack a21 or a22.');
  const directory = release === 'a21' ? root : resolve(root, 'stacks/a22');
  if (!existsSync(resolve(directory, 'node_modules/@softarc/native-federation-esbuild/package.json'))) {
    console.log('Installing locked dependencies for ' + release);
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: directory, stdio: 'inherit' });
  }
  const require = createRequire(resolve(directory, 'package.json'));
  const declared = readJson(resolve(directory, 'package.json')).devDependencies;
  const version = pkg => {
    const actual = require(pkg + '/package.json').version;
    if (!declared[pkg]?.startsWith('file:') && declared[pkg] !== actual) throw new Error(`Expected ${pkg}@${declared[pkg]}, found ${actual}`);
    return actual;
  };
  const shared = Object.fromEntries(sharedEntries.map(entry => {
    const pkg = entry.startsWith('@') ? entry.split('/').slice(0, 2).join('/') : entry.split('/')[0];
    return [entry, version(pkg)];
  }));
  if (version('@angular/compiler-cli') !== shared['@angular/core']) throw new Error('Linker/runtime version mismatch');
  return {
    release, directory, shared, require,
    load: id => import(pathToFileURL(require.resolve(id)).href),
    output: resolve(root, 'dist/stacks', release),
  };
}

export async function linkerFor(target) {
  const { transformAsync } = await target.load('@babel/core');
  const { default: linker } = await target.load('@angular/compiler-cli/linker/babel');
  return async function link(filename) {
    const source = readFileSync(filename, 'utf8');
    const result = await transformAsync(source, {
      filename, babelrc: false, configFile: false, sourceType: 'module',
      plugins: [[linker, { linkerJitMode: false }]],
    });
    return result.code;
  };
}
