import type { NativeFederationResult } from '@angular-architects/native-federation';
import { InjectionToken } from '@angular/core';

export const FEDERATION = new InjectionToken<NativeFederationResult>('Native Federation');
