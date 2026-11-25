import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';

interface FederationRequest {
  origin: string;
  kind: string;
  url: string;
  path: string;
  bytes: number;
}

@Component({
  selector: 'demo-request-table',
  template: `
    <h2>Federation requests</h2>
    <p class="muted">Browser resource timings · response body before decompression</p>
    <div class="request-groups">
      @for (group of groups(); track group.origin; let groupIndex = $index) {
        <section class="request-group">
          <div class="group-heading">
            <h3 [id]="'request-group-' + groupIndex">{{ group.label }}</h3>
            <a [href]="group.url" target="_blank" rel="noopener"><code>{{ group.origin }}</code></a>
          </div>
          <table [attr.aria-labelledby]="'request-group-' + groupIndex">
            <thead><tr><th scope="col">Kind</th><th scope="col">Request</th><th scope="col">Bytes</th></tr></thead>
            <tbody>
              @for (request of group.requests; track $index) {
                <tr>
                  <td>{{ request.kind }}</td>
                  <td><a [href]="request.url" target="_blank" rel="noopener"><code>{{ request.path }}</code></a></td>
                  <td>{{ request.bytes }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      }
    </div>
  `,
  styles: [`
    .request-groups { display:grid; gap:1rem; }
    .request-group { min-width:0; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
    .group-heading { display:flex; align-items:baseline; flex-wrap:wrap; gap:.2rem .85rem; padding:.65rem .8rem; background:var(--tint); border-bottom:1px solid var(--line); }
    .group-heading h3 { color:var(--accent); }
    .group-heading a, td a { overflow-wrap:anywhere; }
    table { width:100%; border-collapse:collapse; font-size:.87rem; }
    td, th { text-align:left; border-bottom:1px solid var(--line); padding:.5rem clamp(.4rem,1.25vw,.8rem); }
    th { color:var(--soft); }
    td:last-child, th:last-child { text-align:right; font-variant-numeric:tabular-nums; }
    tbody tr:last-child td { border-bottom:0; }
  `],
})
export class RequestTable {
  readonly remotes = input.required<{ team: string; title: string; remoteEntry: string }[]>();
  readonly requests = signal<FederationRequest[]>([]);
  readonly groups = computed(() => {
    const labels = new Map([[location.origin, 'Host']]);
    for (const remote of this.remotes()) {
      labels.set(new URL(remote.remoteEntry).origin, remote.team + ' · ' + remote.title);
    }
    const rows = this.requests();
    for (const { origin } of rows) {
      if (!labels.has(origin)) labels.set(origin, 'Remote');
    }
    return [...labels].map(([origin, label]) => ({
      origin, label,
      url: origin === location.origin ? origin : origin + '/remote.json',
      requests: rows.filter(row => row.origin === origin),
    })).filter(group => group.requests.length);
  });

  constructor() {
    const observer = new PerformanceObserver(list => {
      const rows: FederationRequest[] = [];
      for (const resource of list.getEntries() as PerformanceResourceTiming[]) {
        const url = new URL(resource.name);
        let kind: string;
        if (url.pathname === '/remote-config.json') kind = 'Catalog';
        else if (url.pathname === '/remoteEntry.json' && url.origin === location.origin) kind = 'Host entry';
        else if (url.origin === location.origin || !url.protocol.startsWith('http')) continue;
        else if (url.pathname === '/remote.json') kind = 'Team metadata';
        else if (url.pathname.endsWith('/remoteEntry.json')) kind = 'Remote entry';
        else if (url.pathname.endsWith('.js')) kind = 'Feature JS';
        else continue;
        rows.push({ origin: url.origin, kind, url: url.href, path: url.pathname + url.search, bytes: resource.encodedBodySize });
      }
      if (rows.length) this.requests.update(previous => [...previous, ...rows]);
    });
    observer.observe({ type: 'resource', buffered: true });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}
