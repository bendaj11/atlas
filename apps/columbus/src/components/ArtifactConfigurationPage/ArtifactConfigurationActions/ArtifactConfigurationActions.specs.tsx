/** @jest-environment jsdom */

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ArtifactConfigurationActionsDriver } from './ArtifactConfigurationActions.driver.js';

describe('artifact configuration actions', () => {
  let driver: ArtifactConfigurationActionsDriver;

  beforeEach(() => {
    driver = new ArtifactConfigurationActionsDriver();
  });

  afterEach(cleanup);

  it('should call save action when save is clicked', async () => {
    driver.when.rendered();

    await driver.when.saveClicked();

    expect(driver.get.saveCalls()).toBe(1);
  });

  it('should be disabled when save is unavailable', async () => {
    driver.given.saveDisabled().when.rendered();

    expect(await driver.get.saveButton().isButtonDisabled()).toBe(true);
  });

  it('should call clear action when clear is clicked', async () => {
    driver.when.rendered();

    await driver.when.clearClicked();

    expect(driver.get.clearCalls()).toBe(1);
  });

  it('should be disabled when clear is unavailable', async () => {
    driver.given.clearDisabled().when.rendered();

    expect(await driver.get.clearButton().isButtonDisabled()).toBe(true);
  });

  it('should be disabled when cancel is unavailable', async () => {
    driver.given.cancelDisabled().when.rendered();

    expect(await driver.get.cancelButton().isButtonDisabled()).toBe(true);
  });
});
