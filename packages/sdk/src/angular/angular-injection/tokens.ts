import { InjectionToken } from '@angular/core';
import type { AtlasSdk as AtlasSdkValue } from '../../host.js';
import type { AtlasAppContext } from '../../lifecycle.js';

export const ATLAS_SDK = new InjectionToken<AtlasSdkValue>('AtlasSdk');

export const ATLAS_APP_CONTEXT = new InjectionToken<AtlasAppContext>(
  'AtlasAppContext',
);
