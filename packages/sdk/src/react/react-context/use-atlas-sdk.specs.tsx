/** @jest-environment jsdom */

import { faker } from '@faker-js/faker';
import { act } from '@testing-library/react';
import { UseAtlasSdkDriver } from './use-atlas-sdk.driver.js';

describe('useAtlasSdk', () => {
  let driver: UseAtlasSdkDriver;

  beforeEach(() => {
    driver = new UseAtlasSdkDriver();
  });

  it('should throw ATLAS_SDK_CONTEXT_MISSING when rendered outside AtlasSdkProvider', () => {
    expect(() => driver.when.renderedWithoutProvider()).toThrow(
      expect.objectContaining({ code: 'ATLAS_SDK_CONTEXT_MISSING' }),
    );
  });

  describe('when rendered below AtlasSdkProvider', () => {
    const userName = faker.person.firstName();

    beforeEach(() => {
      driver.given.userName(userName).when.rendered();
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
