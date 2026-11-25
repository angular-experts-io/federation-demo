import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

import { hostPort, platform, readJson, root, teams } from '../stacks/stacks.mjs';
import { serve } from '../host/host.mjs';

function verifyArchiveBuilds() {
  // A clean consumer with only the B toolchain and the delivered archives.
  const isolated = mkdtempSync(resolve(tmpdir(), 'angular-artifact-consumer-'));
  try {
    const toolchain = resolve(isolated, 'stacks/a22');
    mkdirSync(toolchain, { recursive: true });
    for (const file of ['tools/stacks/stacks.mjs', 'tools/stacks/shared-runtime.json', 'tools/build-stack/build-stack.mjs', 'tools/remote-config/remote.federation.config.mjs']) {
      const destination = resolve(isolated, file);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(resolve(root, file), destination);
    }
    copyFileSync(resolve(root, 'stacks/a22/package.json'), resolve(toolchain, 'package.json'));
    symlinkSync(resolve(root, 'stacks/a22/node_modules'), resolve(toolchain, 'node_modules'), 'dir');

    for (const team of teams) {
      const { archive } = readJson(resolve(root, 'artifacts/partial', team + '.json'));
      const delivery = resolve(isolated, archive);
      copyFileSync(resolve(root, 'artifacts/partial', archive), delivery);
      const unpackedManifest = JSON.parse(execFileSync('tar', ['-xOzf', delivery, 'package/package.json'], { encoding: 'utf8' }));
      const partial = execFileSync('tar', ['-xOzf', delivery, 'package/' + unpackedManifest.module], { encoding: 'utf8' });
      assert.match(partial, /ɵɵngDeclareComponent/);
      assert.doesNotMatch(partial, /ɵɵdefineComponent/);
      const hash = createHash('sha256').update(readFileSync(delivery)).digest('hex');
      execFileSync(process.execPath, ['tools/build-stack/build-stack.mjs', 'a22', delivery], { cwd: isolated, stdio: 'inherit' });
      for (const release of ['a21', 'a22']) {
        const { output, shared } = platform(release);
        const definition = readJson(resolve(output, team, 'remote.json'));
        assert.equal(definition.artifactSha256, hash);
        assert.deepEqual(definition.required, shared);
        assert.equal(definition.name, team + '-v' + definition.version + '-a' + shared['@angular/core']);
        const archiveEntry = execFileSync('tar', ['-xOzf', resolve(root, 'artifacts/full', definition.name + '.tgz'), './remoteEntry.json']);
        const entry = JSON.parse(archiveEntry);
        assert.equal(entry.name, definition.name);
        assert.equal(entry.exposes[0].key, './Component');
        assert.deepEqual(entry.shared, []);
        assert.equal(definition.bundleBytes, readFileSync(resolve(output, team, definition.entry)).length);
        const evidence = resolve(output, 'reports', team);
        const linked = readFileSync(resolve(evidence, 'linked.mjs'), 'utf8');
        assert.match(linked, /ɵɵdefineComponent/);
        assert.doesNotMatch(linked, /ɵɵngDeclareComponent/);
        const { inputs } = readJson(resolve(evidence, 'bundle.json'));
        assert.equal(Object.keys(inputs).some(file => file.includes('node_modules/chart.js/')), team === 'sales-chart');
        assert.ok(Object.keys(inputs).every(file => !/node_modules\/(?:@angular|rxjs)\//.test(file)));
        if (release === 'a22') {
          const rebuilt = resolve(isolated, 'dist/stacks/a22', team, definition.entry);
          assert.deepEqual(readFileSync(rebuilt), readFileSync(resolve(output, team, definition.entry)));
        }
      }
    }
  } finally {
    rmSync(isolated, { recursive: true, force: true });
  }
  console.log('Verified source-free builds for both pins, full archives, and bundle composition.');
}

async function verifyBrowser(browser) {
  const { shared, output, require } = platform('a22');
  const port = hostPort;
  const hostEntry = readJson(resolve(output, 'host/remoteEntry.json'));
  const cdk = hostEntry.shared.find(provider => provider.packageName === '@angular/cdk');
  for (const [subpath, entry] of Object.entries(require('@angular/cdk/package.json').exports)) {
    if (!entry.default?.endsWith('.mjs') || subpath.startsWith('./testing')) continue;
    const name = subpath.replace(/^\./, '@angular/cdk');
    assert.ok(cdk.entries[name], 'Missing CDK runtime entry ' + name);
  }
  for (const [name, version] of Object.entries(shared)) {
    const provider = hostEntry.shared.find(item => item.packageName === name || Object.hasOwn(item.entries ?? {}, name));
    assert.equal(provider.version, version);
    assert.equal(provider.singleton, true);
  }
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const requests = [];
  const problems = [];
  const interceptorLog = [];
  page.on('request', request => { if (request.url().startsWith('http:')) requests.push(new URL(request.url())); });
  page.on('console', msg => {
    if (msg.text().startsWith('[Host interceptor]')) interceptorLog.push(msg.text());
  });
  page.on('pageerror', err => { problems.push(err.message); console.error(err.message); });
  page.on('console', msg => { if (msg.type() === 'error') console.error(msg.text()); });
  page.on('response', response => { if (response.status() >= 400) problems.push(response.status() + ' ' + response.url()); });
  const remotes = () => requests.filter(url => url.port !== String(port));
  const catalogs = () => requests.filter(url => url.pathname === '/remote-config.json');
  const scripts = () => remotes().filter(url => url.pathname.endsWith('.js')).map(url => Number(url.port));
  const button = name => page.getByRole('button', { name, exact: true });
  try {
    await page.goto('http://localhost:' + port);
    await button('Discover remotes').waitFor();
    assert.deepEqual(remotes(), []);
    assert.equal(catalogs().length, 0);

    await button('Send request from host').click();
    await page.getByText('GET /http-demo.json?caller=host → 200').waitFor();
    assert.deepEqual(remotes(), []);
    await button('Discover remotes').click();
    await button('Open sales chart').waitFor();
    assert.equal(catalogs().length, 1);
    const expected = teams.flatMap((team, index) => {
      const remote = readJson(resolve(output, team, 'remote.json'));
      return [[port + index + 1, '/remote.json'], [port + index + 1, '/' + remote.remoteEntry.slice(2)]];
    });
    assert.deepEqual(remotes().map(url => [Number(url.port), url.pathname]).sort(), expected.sort());

    const versions = page.getByRole('table', { name: 'Shared package versions' });
    const definitions = teams.map(team => readJson(resolve(output, team, 'remote.json')));
    for (const [pkg, version] of Object.entries(shared)) {
      const row = versions.getByRole('row').filter({ has: page.getByRole('rowheader', { name: pkg, exact: true }) });
      const displayed = (await row.getByRole('cell').allTextContents()).map(value => value.trim());
      assert.deepEqual(displayed, [version, ...definitions.map(remote => remote.required[pkg])]);
    }
    const kib = bytes => (bytes / 1024).toFixed(1) + ' KiB';
    const saved = definitions.reduce((sum, remote) => sum + remote.standaloneBytes - remote.bundleBytes, 0);
    await page.locator('.runtime .savings').getByText(kib(saved), { exact: true }).waitFor();
    for (const remote of definitions) {
      const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: remote.title, exact: true }) });
      assert.deepEqual(await card.locator('dd').allTextContents(),
        [remote.bundleBytes, remote.standaloneBytes, remote.standaloneBytes - remote.bundleBytes].map(kib));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.ok((await page.locator('.layout').boundingBox()).width > 1300);

    await button('Record from host').click();
    await button('Open activity').click();
    await page.getByText('Same Router instance as host').waitFor();
    await page.getByText('Same HttpClient instance as host').waitFor();
    await button('Send request from Activity').click();
    await page.getByText('GET /http-demo.json?caller=activity → 200').waitFor();
    assert.deepEqual(requests.filter(url => url.pathname === '/http-demo.json').map(url => url.search),
      ['?caller=host', '?caller=activity']);
    assert.deepEqual(interceptorLog, [
      '[Host interceptor] GET /http-demo.json?caller=host → 200',
      '[Host interceptor] GET /http-demo.json?caller=activity → 200',
    ]);
    await page.getByText('Session count · 1').waitFor();
    await button('Record interaction').click();
    await page.getByText('Count 2 · Last writer activity').waitFor();
    await page.getByRole('link', { name: 'View activity details' }).click();
    await page.getByText('Activity details opened through the host router.').waitFor();
    assert.deepEqual(scripts(), [port + 1]);

    await button('Open sales chart').click();
    await page.getByRole('img', { name: /Weekly revenue/ }).waitFor();
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      return pixels.some((value, i) => i % 4 === 0 && value === 40 && pixels[i+1] === 82 && pixels[i+2] === 200);
    });
    assert.deepEqual(scripts(), [port + 1, port + 2]);
    await page.getByText('Session count · 2').waitFor();
    await button('Record interaction').click();
    await page.getByText('Count 3 · Last writer sales-chart').waitFor();
    await button('Open activity').click();
    await page.getByText('Session count · 3').waitFor();
    assert.deepEqual(scripts(), [port + 1, port + 2]);
    await page.getByRole('row').filter({ hasText: 'Feature JS' }).filter({ hasText: 'sales-chart-v1.0.0-a22.2.0' }).waitFor();
    const requestLog = page.locator('demo-request-table');
    const expectedGroups = [
      ['Host', 'Host entry', 'Catalog'],
      ['Team A · Activity', 'Team metadata', 'Remote entry', 'Feature JS'],
      ['Team B · Sales chart', 'Team metadata', 'Remote entry', 'Feature JS'],
    ];
    assert.deepEqual(await requestLog.getByRole('heading', { level: 3 }).allTextContents(),
      expectedGroups.map(([label]) => label));
    for (const [label, ...kinds] of expectedGroups) {
      const group = requestLog.getByRole('table', { name: label, exact: true });
      assert.deepEqual(await group.locator('td:first-child').allTextContents(), kinds);
    }
    const newEntries = ['@angular/forms', '@angular/cdk/a11y', '@angular/cdk/bidi', '@angular/cdk/overlay', '@angular/cdk/portal', '@angular/cdk/drag-drop'];
    const entryFiles = Object.assign({}, ...hostEntry.shared.map(provider => provider.entries));
    const paths = newEntries.map(entry => '/' + entryFiles[entry]);
    assert.ok(paths.every(path => path !== '/undefined'));
    assert.ok(requests.every(url => !paths.includes(url.pathname)));

    // Exercise bare imports from a remote origin without adding a workshop feature.
    const probe = 'http://localhost:' + (port + 1) + '/shared-runtime-probe.js';
    await page.route(probe, route => route.fulfill({
      contentType: 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: [
        "export { FormControl, Validators } from '@angular/forms';",
        "export { LiveAnnouncer } from '@angular/cdk/a11y';",
        "export { Directionality } from '@angular/cdk/bidi';",
        "export { OverlayContainer } from '@angular/cdk/overlay';",
        "export { ComponentPortal } from '@angular/cdk/portal';",
        "export { DragDrop } from '@angular/cdk/drag-drop';",
      ].join('\n'),
    }));
    const valid = await page.evaluate(async url => {
      const remote = await window.importShim(url);
      const host = await window.importShim('@angular/cdk/overlay');
      const control = new remote.FormControl('', remote.Validators.required);
      return control.invalid && remote.OverlayContainer === host.OverlayContainer &&
        [remote.LiveAnnouncer, remote.Directionality, remote.ComponentPortal, remote.DragDrop].every(token => typeof token === 'function');
    }, probe);
    assert.equal(valid, true);
    assert.ok(paths.every(path => requests.some(url => url.port === String(port) && url.pathname === path)));
    assert.deepEqual(problems, []);
    console.log('Verified lazy catalog, federation registration, separate feature requests, chart rendering, and shared service updates.');
  } finally {
    await page.close();
  }
}

verifyArchiveBuilds();
const stop = await serve();
try {
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  const browser = await chromium.launch({ executablePath });
  try {
    await verifyBrowser(browser);
  } finally {
    await browser.close();
  }
} finally {
  await stop();
}
