import { beforeEach, expect, it } from '@jest/globals';
import { AtlasPreviewUrlsDriver } from './previews.driver.js';

let driver: AtlasPreviewUrlsDriver;

beforeEach(() => {
  driver = new AtlasPreviewUrlsDriver();
});

it('should return previews when package metadata defines HTTP URLs', async () => {
  const previews = [
    'http://localhost:4200/orders',
    'https://staging.example/orders',
  ];
  await driver.given.packageJson({ atlas: { previews } });

  await driver.when.read();

  expect(driver.get.result()).toEqual(previews);
});

it('should return no previews when package metadata omits them', async () => {
  await driver.given.packageJson({ name: 'orders' });

  await driver.when.read();

  expect(driver.get.result()).toEqual([]);
});

it('should reject previews that are not HTTP URLs', async () => {
  await driver.given.packageJson({ atlas: { previews: ['file:///orders'] } });

  await driver.when.read();

  expect(driver.get.errorMessage()).toBe(
    'package.json atlas.previews[0] must be an absolute HTTP URL.',
  );
});
