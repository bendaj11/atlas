import { beforeEach, expect, it } from '@jest/globals';
import { WorkspaceEnvDriver } from './env.driver.js';

let driver: WorkspaceEnvDriver;

beforeEach(() => {
  driver = new WorkspaceEnvDriver();
});

it('should preserve shell values and prefer local values when loading env files', async () => {
  await driver.given.layeredFiles();

  await driver.when.load();

  expect(driver.get.loadedValues()).toStrictEqual(driver.get.layeredValues());
});
