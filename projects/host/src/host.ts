import { Component, EnvironmentInjector, Type, ViewContainerRef, computed, inject, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterOutlet } from '@angular/router';

import { WorkshopSession } from '@demo/workshop-session';

import { FEDERATION } from './federation';
import { HostHttpLog } from './http-log';
import { RequestTable } from './request-table';

interface Platform {
  shared: Record<string, string>;
  hostBytes: number;
  sharedBytes: number;
}

interface RemoteConfig {
  remotes: string[];
}

interface RemoteDefinition {
  title: string;
  team: string;
  version: string;
  name: string;
  remoteEntry: string;
  required: Record<string, string>;
  bundleBytes: number;
  standaloneBytes?: number;
  bundledDependencies: Record<string, number>;
}

interface DiscoveredRemote extends RemoteDefinition {
  mismatch?: string;
  bundled: [string, number][];
}

@Component({
  selector: 'demo-host',
  imports: [RouterOutlet, RequestTable],
  templateUrl: './host.html',
})
export class Host {
  private readonly federation = inject(FEDERATION);
  readonly platform: Platform = JSON.parse(document.querySelector('#platform')!.textContent!);
  readonly remotes = signal<DiscoveredRemote[]>([]);
  readonly packages = computed(() => [...new Set([
    ...Object.keys(this.platform.shared), ...this.remotes().flatMap(remote => Object.keys(remote.required)),
  ])]);
  readonly savedBytes = computed(() => {
    const compatible = this.remotes().filter(remote => !remote.mismatch);
    if (!compatible.length || compatible.some(remote => remote.standaloneBytes === undefined)) return undefined;
    return compatible.reduce((sum, remote) => sum + remote.standaloneBytes! - remote.bundleBytes, 0);
  });
  readonly selected = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly httpLog = inject(HostHttpLog);
  private readonly http = inject(HttpClient);
  readonly httpIdentity = signal('');
  readonly routerIdentity = signal('');
  readonly session = inject(WorkshopSession);
  private readonly outlet = viewChild.required('outlet', { read: ViewContainerRef });
  private readonly injector = inject(EnvironmentInjector);
  private readonly router = inject(Router);

  sendHostRequest() {
    this.http.get('/http-demo.json', { params: { caller: 'host' } }).subscribe();
  }

  async discover() {
    this.busy.set(true);
    this.error.set('');
    try {
      const configResponse = await fetch('/remote-config.json', { cache: 'no-store' });
      if (!configResponse.ok) throw new Error('Remote configuration unavailable');
      const config: RemoteConfig = await configResponse.json();
      const definitions = await Promise.all(config.remotes.map(async url => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Definition unavailable at ' + url);
        const definition: RemoteDefinition = await response.json();
        const mismatch = Object.entries(definition.required).find(([pkg, version]) =>
          this.platform.shared[pkg] !== version);
        return {
          ...definition,
          bundled: Object.entries(definition.bundledDependencies),
          remoteEntry: new URL(definition.remoteEntry, url).href,
          mismatch: mismatch && `${mismatch[0]} requires ${mismatch[1]} · host provides ${this.platform.shared[mismatch[0]] ?? 'no version'}`,
        };
      }));
      for (const remote of definitions) {
        if (!remote.mismatch) await this.federation.initRemoteEntry(remote.remoteEntry, remote.name);
      }
      this.remotes.set(definitions);
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.busy.set(false);
    }
  }

  async open(remote: DiscoveredRemote) {
    this.busy.set(true);
    this.error.set('');
    try {
      const feature = await this.federation.loadRemoteModule<{ RemoteComponent: Type<{ router?: Router; http?: HttpClient }> }>(
        remote.name, './Component',
      );
      await this.router.navigateByUrl('/');
      this.outlet().clear();
      const ref = this.outlet().createComponent(feature.RemoteComponent, { environmentInjector: this.injector });
      this.selected.set(remote.title);
      this.httpIdentity.set(ref.instance.http === this.http ? 'Same HttpClient instance as host' : '');
      this.routerIdentity.set(ref.instance.router === this.router ? 'Same Router instance as host' : '');
    } catch (err) {
      this.error.set(String(err));
    } finally {
      this.busy.set(false);
    }
  }

  size(bytes: number) {
    return (bytes / 1024).toFixed(1) + ' KiB';
  }
}
