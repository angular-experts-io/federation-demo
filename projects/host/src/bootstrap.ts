import type { NativeFederationResult } from '@angular-architects/native-federation';
import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { WorkshopSession } from '@demo/workshop-session';

import { FEDERATION } from './federation';
import { Host } from './host';
import { logHttpResponse } from './http-log';

@Component({
  template: '<p class="route-detail">Activity details opened through the host router.</p>',
})
class ActivityDetails {}

export function bootstrap(federation: NativeFederationResult) {
  return bootstrapApplication(Host, {
    providers: [
      { provide: WorkshopSession, useFactory: () => new WorkshopSession() },
      { provide: FEDERATION, useValue: federation },
      provideHttpClient(withInterceptors([logHttpResponse])),
      provideRouter([{ path: 'activity/details', component: ActivityDetails }]),
    ],
  });
}
