import { AsyncPipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { of } from 'rxjs';

import { WorkshopSession } from '@demo/workshop-session';

@Component({
  selector: 'demo-activity',
  imports: [AsyncPipe, DecimalPipe, RouterLink],
  template: `
    <h2>Activity</h2>
    <p class="muted">Order activity across the last three shifts</p>
    @for (shift of shifts | async; track shift.name) {
      <div class="shift"><span>{{ shift.name }}</span><strong>{{ shift.orders | number }} orders</strong></div>
    }
    <a class="details-link" routerLink="/activity/details">View activity details →</a>
    <div class="actions">
      <div class="session-action">
        <button (click)="session.record('activity')">Record interaction</button>
        <span>Session count · {{ session.count() }}</span>
      </div>
      <button (click)="sendRequest()">Send request from Activity</button>
    </div>
  `,
  styles: [`
    .shift { display: flex; justify-content: space-between; padding: .8rem 0; border-bottom: 1px solid var(--line); }
    .details-link { display: inline-block; margin-top: 1rem; }
    .actions, .session-action { display: flex; align-items: center; flex-wrap: wrap; }
    .actions { gap: .75rem 2rem; margin-top: 1rem; }
    .session-action { gap: .5rem .75rem; }
    .session-action span { color: var(--soft); font-size: .9rem; font-variant-numeric: tabular-nums; }
    .actions button { margin: 0; }
  `],
})
export class RemoteComponent {
  readonly http = inject(HttpClient);
  readonly session = inject(WorkshopSession);
  readonly router = inject(Router);
  readonly shifts = of([
    { name: 'Morning', orders: 1230 },
    { name: 'Afternoon', orders: 1452 },
    { name: 'Evening', orders: 972 },
  ]);

  sendRequest() {
    this.http.get('/http-demo.json', { params: { caller: 'activity' } }).subscribe();
  }
}
