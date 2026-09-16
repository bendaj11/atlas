import { expect, it } from '@jest/globals';
import { angularAppConfig, angularAppEntry } from './angular-app-generator.js';

it('should pass Atlas style target into application configuration when generating an app entry', () => {
  const entry = angularAppEntry({
    name: 'orders',
    routed: true,
    zoneless: false,
  });

  expect(entry).toContain(
    'createApplication(createAppConfig({ context, sdk, styleTarget, locationStrategy }))',
  );
});

it('should group Atlas dependencies for a single-page Angular application', () => {
  const config = angularAppConfig({
    routed: false,
    requiresZonelessProvider: false,
  });

  expect(config).toContain('provideAtlasApp({ context, sdk, styleTarget })');
});

it('should group Atlas dependencies when generating Angular application configuration', () => {
  const config = angularAppConfig({
    routed: true,
    requiresZonelessProvider: false,
  });

  expect(config).toContain(
    'provideAtlasApp({ context, sdk, styleTarget, locationStrategy })',
  );
});
