import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { linkerFor, platform, readJson, root, teams, writeJson } from '../stacks/stacks.mjs';

const target = platform(process.argv[2]);
const requested = process.argv[3];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function measureWithoutSharing(context, link) {
  const result = await context.esbuild.build({
    ...context.initialOptions,
    external: [],
    write: false,
    plugins: [{
      name: 'link-angular-runtime',
      setup(build) {
        build.onLoad({ filter: /[/\\]@angular[/\\].*\.mjs$/ }, async ({ path }) => ({
          contents: await link(path), loader: 'js',
        }));
      },
    }],
  });
  return result.outputFiles.reduce((total, file) => total + file.contents.length, 0);
}

async function linkArchive(archive) {
  const stageRoot = resolve(target.directory, '.stage');
  mkdirSync(stageRoot, { recursive: true });
  const stage = mkdtempSync(resolve(stageRoot, 'link-'));

  try {
    execFileSync('tar', ['-xzf', archive, '-C', stage], { stdio: 'inherit' });
    const pkg = resolve(stage, 'package');
    const manifest = readJson(resolve(pkg, 'package.json'));
    const team = manifest.name.replace('@demo/', '');
    if (!teams.includes(team)) throw new Error('Unknown team package ' + manifest.name);
    const partialEntry = resolve(pkg, manifest.exports['.'].default);
    const digest = sha(readFileSync(archive));
    console.log('\n  Input       ' + basename(archive) + ' · producer Angular ' + manifest.demo.producerAngular);
    console.log('  SHA-256     ' + digest);
    console.log('  Link        ɵɵngDeclareComponent → ɵɵdefineComponent · Angular ' + target.shared['@angular/core']);
    const link = await linkerFor(target);
    const linked = await link(partialEntry);
    const linkedEntry = resolve(pkg, 'linked.mjs');
    writeFileSync(linkedEntry, linked);

    const output = resolve(target.output, team);
    mkdirSync(output, { recursive: true });
    const artifactId = team + '-v' + manifest.version + '-a' + target.shared['@angular/core'];
    const folder = resolve(output, artifactId);
    writeJson(resolve(pkg, 'delivery.json'), { name: artifactId, required: target.shared });
    copyFileSync(resolve(root, 'tools/remote-config/remote.federation.config.mjs'), resolve(pkg, 'federation.config.mjs'));
    const { runEsBuildBuilder } = await target.load('@softarc/native-federation-esbuild');
    let metafile;
    let featureBuild;
    const build = await runEsBuildBuilder('federation.config.mjs', {
      workspaceRoot: pkg, projectName: artifactId, outputPath: 'release', cachePath: resolve(stage, 'cache'),
      adapterConfig: {
        define: { ngDevMode: 'false' },
        plugins: [{ name: 'workshop-bundle-report', setup(context) {
          featureBuild = context;
          context.onEnd(result => { metafile = result.metafile; });
        } }],
      },
    });
    await build.close();
    const deployment = resolve(pkg, 'release');
    const file = build.federationInfo.exposes.find(exposure => exposure.key === './Component').outFileName;
    const bytes = readFileSync(resolve(deployment, file));
    const contribution = {};
    for (const output of Object.values(metafile.outputs)) {
      for (const [input, { bytesInOutput }] of Object.entries(output.inputs)) {
        const dependency = input.split('node_modules/').pop();
        if (dependency === input) continue;
        const parts = dependency.split('/');
        const name = parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
        contribution[name] = (contribution[name] ?? 0) + bytesInOutput;
      }
    }
    const definition = {
      ...manifest.demo, version: manifest.version, release: target.release.toUpperCase(),
      bundleBytes: bytes.length, standaloneBytes: await measureWithoutSharing(featureBuild, link), bundledDependencies: contribution,
      name: artifactId, required: target.shared, entry: './' + artifactId + '/' + file,
      remoteEntry: './' + artifactId + '/remoteEntry.json',
      artifact: basename(archive), artifactSha256: digest,
    };
    cpSync(deployment, folder, { recursive: true });
    writeJson(resolve(deployment, 'build.json'), definition);
    const deliveries = resolve(root, 'artifacts/full');
    mkdirSync(deliveries, { recursive: true });
    execFileSync('tar', ['-czf', resolve(deliveries, artifactId + '.tgz'), '-C', deployment, '.'], { stdio: 'inherit' });
    // Keep the linker output readable beside the minified deployment for the workshop.
    const evidence = resolve(target.output, 'reports', team);
    mkdirSync(evidence, { recursive: true });
    writeFileSync(resolve(evidence, 'linked.mjs'), linked);
    writeJson(resolve(evidence, 'bundle.json'), metafile);
    writeJson(resolve(evidence, 'build.json'), definition);
    writeJson(resolve(output, 'remote.json'), definition);
    console.log('  Exposure    ./Component → ' + file);
    console.log('  Feature JS  ' + bytes.length.toLocaleString('en-US') + ' bytes (minified, uncompressed)');
    for (const [name, size] of Object.entries(contribution)) {
      console.log('  Private     ' + name + ' · ' + size.toLocaleString('en-US') + ' bytes in output');
    }
    if (!Object.keys(contribution).length) console.log('  Private     0 bytes of bundled dependencies');
    console.log('  Full build  artifacts/full/' + artifactId + '.tgz');
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

console.log('\nFull remote builds · ' + target.release);
console.log('  Host supplies ' + Object.entries(target.shared).map(([pkg, version]) => pkg + '@' + version).join(', '));
if (requested?.endsWith('.tgz')) {
  await linkArchive(resolve(requested));
} else {
  if (requested && !teams.includes(requested)) throw new Error('Choose a team or provide a partial .tgz.');
  for (const team of requested ? [requested] : teams) {
    const { archive } = readJson(resolve(root, 'artifacts/partial', team + '.json'));
    await linkArchive(resolve(root, 'artifacts/partial', archive));
  }
}
