/** @jest-environment jsdom */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { EmptyHostDataStateDriver } from './EmptyHostDataState.driver.js';

describe('empty host data state', () => {
  let driver: EmptyHostDataStateDriver;

  beforeEach(() => {
    driver = new EmptyHostDataStateDriver();
  });

  afterEach(cleanup);

  it('should show failure reason when host data is unavailable', async () => {
    driver.given.message('Active tab has no Atlas runtime.').when.rendered();

    expect(await driver.get.emptyState().getSubtitleText()).toBe(
      'Active tab has no Atlas runtime.',
    );
  });

  it('should request another inspection when refresh is clicked', async () => {
    driver.when.rendered();

    await driver.when.refreshClicked();

    expect(driver.get.refreshCalls()).toBe(1);
  });
});
