import { LocationStrategy } from '@angular/common';
import {
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import {
  createLocationStrategy,
  provideAtlasAppContext,
  provideAtlasSdk,
} from '@atlas/sdk/angular';
import type { MockAtlasEnvironment } from '../atlas-environment/atlas-environment.types.js';

export function provideMockAtlasEnvironment<
  THostSdk extends object,
  TEvents extends object,
>(environment: MockAtlasEnvironment<THostSdk, TEvents>): EnvironmentProviders {
  const { sdk, context } = environment;

  if (!context) return makeEnvironmentProviders([provideAtlasSdk(sdk)]);

  return makeEnvironmentProviders([
    provideAtlasSdk(sdk),
    ...provideAtlasAppContext(context),
    { provide: LocationStrategy, useValue: createLocationStrategy(context) },
  ]);
}
