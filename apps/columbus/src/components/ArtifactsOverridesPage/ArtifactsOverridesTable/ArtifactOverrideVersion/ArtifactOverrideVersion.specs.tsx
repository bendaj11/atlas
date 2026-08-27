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

  it('should show version and build ID together when artifact uses production version', () => {
    driver.given.productionBuildId('abcdefg-build').when.rendered();

    expect(driver.get.versionText('1.0.0-abcdefg-build')).toBe(
      '1.0.0-abcdefg-build',
    );
  });

  it('should show override source description when artifact has a PR override', () => {
    driver.given.override('pr').when.rendered();

    expect(
      driver.get.versionText('feature/orders · abc1234 · Update orders'),
    ).toBe('feature/orders · abc1234 · Update orders');
  });

  it('should show custom URL when artifact has a custom override', () => {
    driver.given.customOverrideUrl('http://localhost:4303').when.rendered();

    expect(driver.get.versionText('http://localhost:4303')).toBe(
      'http://localhost:4303',
    );
  });

  it('should use standard text color when artifact has an override', async () => {
    driver.given.override('pr').when.rendered();

    expect(await driver.get.version().getSkin()).toBe('standard');
  });

  it('should use standard text color when selected production version is enabled', async () => {
    driver.given.enabledProductionSelection().when.rendered();

    expect(await driver.get.version().getSkin()).toBe('standard');
  });

  it('should use error text color when artifact failed to load', async () => {
    driver.given.loadError('Unable to load Orders.').when.rendered();

    expect(await driver.get.version().getSkin()).toBe('error');
  });
});
