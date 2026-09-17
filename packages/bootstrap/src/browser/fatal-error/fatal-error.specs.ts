import { faker } from '@faker-js/faker';
import { aBootstrapFailure } from '../../testkit/bootstrap-failure.testkit.js';
import { FatalErrorDriver } from './fatal-error.driver.js';

describe('showFatalError', () => {
  let driver: FatalErrorDriver;

  beforeEach(() => {
    driver = new FatalErrorDriver();
  });

  it('should describe the given error when shown', () => {
    const error = new Error(faker.lorem.sentence());
    driver.given.failure(aBootstrapFailure()).when.shown(error);

    expect(driver.get.describeFatalErrorMock()).toHaveBeenCalledWith(error);
  });

  it('should render the panel into the host root when the host root exists', () => {
    driver.given
      .failure(aBootstrapFailure())
      .given.hostRootPresent(true)
      .when.shown({});

    expect(driver.get.hostRootChildCount()).toBe(1);
  });

  it('should render the panel into the body when the host root is missing', () => {
    driver.given
      .failure(aBootstrapFailure())
      .given.hostRootPresent(false)
      .when.shown({});

    expect(driver.get.bodyChildCount()).toBe(1);
  });

  it('should show the failure message when shown', () => {
    const failure = aBootstrapFailure();
    driver.given.failure(failure).when.shown({});

    expect(driver.get.message()).toBe(failure.message);
  });

  it('should list the suggested actions when shown', () => {
    const failure = aBootstrapFailure();
    driver.given.failure(failure).when.shown({});

    expect(driver.get.actions()).toEqual(failure.suggestedActions);
  });

  it('should use the singular heading when one action is suggested', () => {
    driver.given
      .failure(
        aBootstrapFailure({ suggestedActions: [faker.lorem.sentence()] }),
      )
      .when.shown({});

    expect(driver.get.actionHeading()).toBe('Suggested action');
  });

  it('should use the plural heading when several actions are suggested', () => {
    driver.given.failure(aBootstrapFailure()).when.shown({});

    expect(driver.get.actionHeading()).toBe('Suggested actions');
  });

  it('should log the failure when shown', () => {
    const failure = aBootstrapFailure();
    driver.given.failure(failure).when.shown({});

    expect(driver.get.logErrorMock()).toHaveBeenCalledWith(
      'Atlas bootstrap could not start the product.',
      failure,
    );
  });

  describe('when the user clears overrides', () => {
    beforeEach(() => {
      driver.given.failure(aBootstrapFailure()).when.shown({});
      driver.when.overridesCleared();
    });

    it('should remove the override document from local storage when cleared', () => {
      expect(driver.get.localStorageMock()).toHaveBeenCalledWith(
        'atlas.runtime-overrides',
      );
    });

    it('should remove the override document from session storage when cleared', () => {
      expect(driver.get.sessionStorageMock()).toHaveBeenCalledWith(
        'atlas.runtime-overrides',
      );
    });

    it('should reload the page when cleared', () => {
      expect(driver.get.reloadPageMock()).toHaveBeenCalledTimes(1);
    });
  });
});
