import { beforeEach, describe, expect, it } from '@jest/globals';
import { createManifest } from '../../../../types/app.testkit.js';
import { FilterArtifactsDriver } from './filterArtifacts.driver.js';

describe('filterArtifacts', () => {
  let driver: FilterArtifactsDriver;

  beforeEach(() => {
    driver = new FilterArtifactsDriver();
  });

  it('should keep all artifacts when no search and no visibility filter', () => {
    const first = driver.given.artifact({});
    const second = driver.given.artifact({});

    driver.when.filtered();

    expect(driver.get.artifacts()).toEqual([first, second]);
  });

  it('should drop hidden artifacts when visibleOnly is set', () => {
    driver.given.artifact({ visible: false });
    const visible = driver.given.artifact({ visible: true });

    driver.given.visibleOnly().when.filtered();

    expect(driver.get.artifacts()).toEqual([visible]);
  });

  it('should count visible artifacts as total when visibleOnly is set', () => {
    driver.given.artifact({ visible: false });
    driver.given.artifact({ visible: true });

    driver.given.visibleOnly().given.searchValue('no-match').when.filtered();

    expect(driver.get.totalCount()).toBe(1);
  });

  it('should match name case-insensitively when searching', () => {
    driver.given.artifact({
      productionManifest: createManifest({ name: 'Cart' }),
    });
    const orders = driver.given.artifact({
      productionManifest: createManifest({ name: 'Orders' }),
    });

    driver.given.searchValue('  oRdErS ').when.filtered();

    expect(driver.get.artifacts()).toEqual([orders]);
  });

  it('should match source description when searching', () => {
    driver.given.artifact({ sourceDescription: 'main · abc1234' });
    const local = driver.given.artifact({
      sourceDescription: 'http://localhost:4200',
    });

    driver.given.searchValue('localhost').when.filtered();

    expect(driver.get.artifacts()).toEqual([local]);
  });

  it('should keep total count unfiltered when search narrows results', () => {
    driver.given.artifact({ sourceDescription: 'alpha' });
    driver.given.artifact({ sourceDescription: 'beta' });

    driver.given.searchValue('alpha').when.filtered();

    expect(driver.get.totalCount()).toBe(2);
  });

  it('should order enabled overrides before toggleable before plain artifacts', () => {
    const plain = driver.given.artifact({});
    const toggleable = driver.given.artifact({ canToggle: true });
    const enabled = driver.given.artifact({
      canToggle: true,
      overrideEnabled: true,
    });

    driver.when.filtered();

    expect(driver.get.artifacts()).toEqual([enabled, toggleable, plain]);
  });

  it('should keep input order when artifacts share the same rank', () => {
    const first = driver.given.artifact({ canToggle: true });
    const second = driver.given.artifact({ canToggle: true });

    driver.when.filtered();

    expect(driver.get.artifacts()).toEqual([first, second]);
  });
});
