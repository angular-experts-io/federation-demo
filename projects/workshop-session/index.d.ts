import type { Signal } from '@angular/core';

export declare class WorkshopSession {
  readonly count: Signal<number>;
  readonly lastWriter: Signal<string>;
  record(writer: string): void;
}
