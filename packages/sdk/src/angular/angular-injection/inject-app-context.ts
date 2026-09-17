import { inject } from '@angular/core';
import type { AtlasAppContext } from '../../lifecycle.js';
import { ATLAS_APP_CONTEXT } from './tokens.js';

export function injectAtlasAppContext(): AtlasAppContext {
  return inject(ATLAS_APP_CONTEXT);
}

/** Defers host readiness until the returned callback runs. */
export function injectAppLoaded(): () => void {
  return injectAtlasAppContext().loading.waitUntilReady();
}
