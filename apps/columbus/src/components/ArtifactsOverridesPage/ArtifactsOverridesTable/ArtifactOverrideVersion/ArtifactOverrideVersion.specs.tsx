/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { cleanup } from '@testing-library/react';
import { ArtifactOverrideVersionDriver } from './ArtifactOverrideVersion.driver.js';

describe('artifact override version state', () => {
  let driver: ArtifactOverrideVersionDriver;

  beforeEach(() => {
    driver = new ArtifactOverrideVersionDriver();
  });

  afterEach(cleanup);

  it('should use disabled text color when artifact uses production version', async () => {
    driver.when.rendered();

    expect(await driver.get.version().getSkin()).toBe('disabled');
  });

  it('should use standard text color when artifact has an override', async () => {
    driver.given.override('pr').when.rendered();

    expect(await driver.get.version().getSkin()).toBe('standard');
  });

  it('should use error text color when artifact failed to load', async () => {
    driver.given.loadError('Unable to load Orders.').when.rendered();

    expect(await driver.get.version().getSkin()).toBe('error');
  });
});
