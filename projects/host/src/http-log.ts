import { Injectable, inject, signal } from '@angular/core';
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class HostHttpLog {
  readonly entries = signal<string[]>([]);

  record(message: string) {
    console.info('[Host interceptor]', message);
    this.entries.update(entries => [...entries, message]);
  }
}

export const logHttpResponse: HttpInterceptorFn = (request, next) => {
  const log = inject(HostHttpLog);
  const record = (status: number) => log.record(request.method + ' ' + request.urlWithParams + ' → ' + status);
  return next(request).pipe(tap({
    next: event => { if (event instanceof HttpResponse) record(event.status); },
    error: error => record(error.status),
  }));
};
