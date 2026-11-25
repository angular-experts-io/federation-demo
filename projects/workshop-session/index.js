import { signal } from '@angular/core';

export class WorkshopSession {
  count = signal(0);
  lastWriter = signal('—');

  record(writer) {
    this.count.update(count => count + 1);
    this.lastWriter.set(writer);
  }
}
