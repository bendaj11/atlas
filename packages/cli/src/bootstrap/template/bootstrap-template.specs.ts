import { beforeEach, describe, expect, it } from '@jest/globals';
import { BootstrapTemplateDriver } from './bootstrap-template.driver.js';

describe('loadBootstrapTemplate', () => {
  let driver: BootstrapTemplateDriver;

  beforeEach(() => {
    driver = new BootstrapTemplateDriver();
  });

  it('should return template contents when default template exists', async () => {
    driver.given.template({ location: 'default' });

    await driver.when.load();

    expect(driver.get.result()).toBe(driver.get.contents());
  });

  it('should read project template when path is omitted', async () => {
    driver.given.template({ location: 'default' });

    await driver.when.load();

    expect(driver.get.requestedPath()).toBe(driver.get.defaultPath());
  });

  it('should return undefined when default template is missing', async () => {
    driver.given.template({
      location: 'default',
      failure: 'missing',
    });

    await driver.when.load();

    expect(driver.get.result()).toBeUndefined();
  });

  it('should resolve the project path when a relative template is configured', async () => {
    driver.given.template({ location: 'relative' });

    await driver.when.load();

    expect(driver.get.requestedPath()).toBe(driver.get.relativePath());
  });

  it('should preserve the path when an absolute template is configured', async () => {
    driver.given.template({ location: 'absolute' });

    await driver.when.load();

    expect(driver.get.requestedPath()).toBe(driver.get.absolutePath());
  });

  it('should reject when configured template is missing', async () => {
    driver.given.template({ location: 'relative', failure: 'missing' });

    await expect(driver.when.load()).rejects.toThrow(driver.get.error());
  });

  it('should reject when default template cannot be read', async () => {
    driver.given.template({ location: 'default', failure: 'read' });

    await expect(driver.when.load()).rejects.toThrow(driver.get.error());
  });
});
