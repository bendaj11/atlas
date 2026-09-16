/** @jest-environment jsdom */

import { beforeEach, describe, expect, it } from '@jest/globals';
import { ReactContextDriver } from './react-context.driver.js';

describe('useAtlasStyleTarget', () => {
  let driver: ReactContextDriver;

  beforeEach(() => {
    driver = new ReactContextDriver();
  });

  it('should provide style target when app is mounted by Atlas', () => {
    driver.when.renderMountedApp();

    expect(driver.get.styleTargetStatus()).toBe('available');
  });
});
