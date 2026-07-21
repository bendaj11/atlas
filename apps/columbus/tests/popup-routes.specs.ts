import { expect, test } from '@jest/globals';
import { ARTIFACT_CONFIGURATION_ROUTE } from '../src/popup/popup-routes.js';

test('artifact configuration uses a stable route for state navigation', () => {
  expect(ARTIFACT_CONFIGURATION_ROUTE).toBe('/artifact/edit');
});
