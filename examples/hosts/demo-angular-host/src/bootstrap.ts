import 'zone.js';
import { defineAngularHost } from '@atlas/runtime/angular';
import atlasConfig from '../atlas.config';
import { AppComponent } from './app.component';

export const mount = defineAngularHost({
  config: atlasConfig,
  component: AppComponent,
  sdkOptions: () => ({}),
});
