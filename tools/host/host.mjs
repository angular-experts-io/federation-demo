import { execFile, execFileSync } from 'node:child_process';
import { cpSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { hostPort, platform, readJson, root, teams, writeJson } from '../stacks/stacks.mjs';

function buildHost() {
  const target = platform('a22');
  console.log('\nHost build · Angular ' + target.shared['@angular/core'] + ' · Native Federation shared singletons');
  // The same host source is compiled in the selected release's dependency tree.
  const stage = resolve(target.directory, '.stage/host');
  mkdirSync(stage, { recursive: true });
  cpSync(resolve(root, 'projects/host'), resolve(stage, 'projects/host'), { recursive: true });
  writeJson(resolve(stage, 'projects/host/shared-versions.json'), target.shared);
  cpSync(resolve(root, 'tsconfig.json'), resolve(stage, 'tsconfig.json'));
  cpSync(resolve(target.directory, 'package.json'), resolve(stage, 'package.json'));
  rmSync(resolve(stage, 'node_modules'), { force: true });
  symlinkSync(resolve(target.directory, 'node_modules'), resolve(stage, 'node_modules'), 'dir');
  const workspace = readJson(resolve(root, 'angular.json'));
  workspace.projects = { host: workspace.projects.host };
  writeJson(resolve(stage, 'angular.json'), workspace);
  execFileSync(process.execPath, [resolve(target.directory, 'node_modules/@angular/cli/bin/ng.js'), 'build', 'host'], {
    cwd: stage, stdio: 'inherit',
  });
  const host = resolve(target.output, 'host');
  rmSync(host, { recursive: true, force: true });
  cpSync(resolve(stage, 'dist/host/browser'), host, { recursive: true });

  const remoteUrl = (port, index) => 'http://localhost:' + (port + index + 1) + '/remote.json';
  const sharedFiles = new Set(Object.values(readJson(resolve(host, 'importmap.json')).imports));
  const jsBytes = files => files.reduce((total, file) => total + statSync(resolve(host, file)).size, 0);
  const config = {
    shared: target.shared,
    hostBytes: jsBytes(readdirSync(host).filter(file => file.endsWith('.js'))),
    sharedBytes: jsBytes([...sharedFiles]),
  };
  writeJson(resolve(host, 'remote-config.json'), {
    remotes: teams.map((_, index) => remoteUrl(hostPort, index)),
  });
  const scripts = '<script type="application/json" id="platform">' + JSON.stringify(config) + '</script>';
  const index = resolve(host, 'index.html');
  writeFileSync(index, readFileSync(index, 'utf8').replace('<head>', '<head>\n' + scripts));
}

const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

export async function serve() {
  const servers = [];
  try {
    for (const [offset, project] of ['host', ...teams].entries()) {
      const directory = resolve(root, 'dist/stacks/a22', project);
      const host = project === 'host';
      const entry = host ? 'index.html' : 'remote.json';
      if (!existsSync(resolve(directory, entry))) throw new Error('Build first. Missing ' + resolve(directory, entry));
      const server = createServer((request, response) => {
        const path = new URL(request.url, 'http://localhost').pathname;
        let file = resolve(directory, '.' + path);
        if (file !== directory && !file.startsWith(directory + sep)) {
          response.writeHead(404).end();
          return;
        }
        if (host && !extname(path)) file = resolve(directory, 'index.html');
        if (!existsSync(file) || !statSync(file).isFile()) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': contentTypes[extname(file)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
          'Timing-Allow-Origin': '*',
        });
        createReadStream(file).pipe(response);
      });
      await new Promise((accept, reject) => {
        server.once('error', reject);
        server.listen(hostPort + offset, 'localhost', accept);
      });
      servers.push(server);
    }
    console.log('Native Federation host · http://localhost:' + hostPort);
    console.log('Discover remotes → register JSON definitions. Open a remote → download its exposed JavaScript.');
    return () => Promise.all(servers.map(server => new Promise(done => server.close(done))));
  } catch (error) {
    for (const server of servers) server.close();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'build') buildHost();
  else if (process.argv[2] === 'serve') {
    await serve();
    if (process.argv.includes('--open')) {
      const url = 'http://localhost:' + hostPort;
      const [command, ...args] = process.platform === 'darwin' ? ['open', url]
        : process.platform === 'win32' ? ['rundll32', 'url.dll,FileProtocolHandler', url] : ['xdg-open', url];
      execFile(command, args, error => {
        if (error) console.warn('Open the Remote explorer at ' + url);
      });
    }
  }
  else throw new Error('Choose build or serve.');
}
