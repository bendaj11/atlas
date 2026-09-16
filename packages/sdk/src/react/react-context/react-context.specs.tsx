/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { act } from '@testing-library/react';
import { ReactContextDriver } from './react-context.driver.js';

describe('useAtlasSdk', () => {
  let driver: ReactContextDriver;

  beforeEach(() => {
    driver = new ReactContextDriver();
  });

  it('should throw ATLAS_SDK_CONTEXT_MISSING when rendered outside AtlasSdkProvider', () => {
    expect(() => driver.when.sdkConsumerRenderedWithoutProvider()).toThrow(
      expect.objectContaining({ code: 'ATLAS_SDK_CONTEXT_MISSING' }),
    );
  });

  describe('when rendered below AtlasSdkProvider', () => {
    const userName = faker.person.firstName();

    beforeEach(() => {
      driver.given.userName(userName).when.sdkConsumerRendered();
    });

    it('should expose the current host data when rendered', () => {
      expect(driver.get.hostUser()).toBe(userName);
    });

    it('should re-render with the new host data when the host updates it', () => {
      const renamed = faker.person.firstName();

      act(() => driver.when.hostUserRenamed(renamed));

      expect(driver.get.hostUser()).toBe(renamed);
    });
  });
});

describe('useAtlasStyleTarget', () => {
  let driver: ReactContextDriver;

  beforeEach(() => {
    driver = new ReactContextDriver();
  });

  it('should provide the style target when rendered below AtlasStyleTargetContext', () => {
    driver.when.styleTargetConsumerRendered();

    expect(driver.get.styleTargetStatus()).toBe('available');
  });

  it('should throw ATLAS_STYLE_TARGET_MISSING when rendered outside an Atlas mount', () => {
    expect(() =>
      driver.when.styleTargetConsumerRenderedWithoutProvider(),
    ).toThrow(expect.objectContaining({ code: 'ATLAS_STYLE_TARGET_MISSING' }));
  });
});

describe('useAppLoaded', () => {
  let driver: ReactContextDriver;

  beforeEach(() => {
    driver = new ReactContextDriver();
  });

  it('should call waitUntilReady when rendered inside an Atlas app context', () => {
    driver.when.appLoadedConsumerRendered();

    expect(driver.get.waitUntilReadyMock()).toHaveBeenCalledTimes(1);
  });

  it('should throw ATLAS_APP_CONTEXT_MISSING when rendered outside an Atlas app context', () => {
    driver.given.appContext(undefined);

    expect(() => driver.when.appLoadedConsumerRendered()).toThrow(
      expect.objectContaining({ code: 'ATLAS_APP_CONTEXT_MISSING' }),
    );
  });
});
