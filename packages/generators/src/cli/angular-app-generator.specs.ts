import { expect, it } from '@jest/globals';
import {
  angularAppConfig,
  angularAppEntry,
  angularSinglePageAppConfig,
} from './angular-app-generator.js';

it('should pass Atlas style target into application configuration when generating an app entry', () => {
  const entry = angularAppEntry('orders', false);

  expect(entry).toContain(
    'createApplication(createAppConfig({ context, sdk, styleTarget, locationStrategy }))',
  );
});

it('should group Atlas dependencies for a single-page Angular application', () => {
  const config = angularSinglePageAppConfig(false);

  expect(config).toContain('provideAtlasApp({ context, sdk, styleTarget })');
});

it('should group Atlas dependencies when generating Angular application configuration', () => {
  const config = angularAppConfig(false);

  expect(config).toContain(
    'provideAtlasApp({ context, sdk, styleTarget, locationStrategy })',
  );
});
