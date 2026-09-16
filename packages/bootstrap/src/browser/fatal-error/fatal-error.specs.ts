import { faker } from '@faker-js/faker';
import { AtlasError } from '@atlas/schema';
import { FatalErrorDriver } from './fatal-error.driver.js';

const FALLBACK_ACTIONS = [
  ['invalid override', 'Select Clear overrides and reload below.'],
  [
    'failed integrity validation',
    'Verify atlas.runtime.json registry origins and the selected host remote-entry URL.',
  ],
  [
    'host root is missing',
    'Verify the bootstrap page contains #atlas-host-root and the selected host client exports mount(request).',
  ],
  [
    'catalog is malformed',
    'Verify /atlas.runtime.json and the selected environment manifest return valid Atlas JSON.',
  ],
  [
    'fetch timed out',
    'Open the failed URL from the error details and verify it is reachable.',
  ],
  [
    'something else',
    'Inspect the preserved cause in the browser console for the first failing URL or configuration value.',
  ],
];

describe('showFatalError', () => {
  let driver: FatalErrorDriver;

  beforeEach(() => {
    driver = new FatalErrorDriver();
  });

  it('should render the panel into the host root when the host root exists', () => {
    driver.given
      .hostRootPresent(true)
      .when.shown(new Error(faker.lorem.sentence()));

    expect(driver.get.hostRootChildCount()).toBe(1);
  });

  it('should render the panel into the body when the host root is missing', () => {
    driver.given
      .hostRootPresent(false)
      .when.shown(new Error(faker.lorem.sentence()));

    expect(driver.get.bodyChildCount()).toBe(1);
  });

  it('should log the failure when shown', () => {
    const error = new Error(faker.lorem.sentence());
    driver.when.shown(error);

    expect(driver.get.logErrorMock()).toHaveBeenCalledWith(
      'Atlas bootstrap could not start the product.',
      expect.objectContaining({ cause: error }),
    );
  });

  describe('when the error is an Atlas error', () => {
    it('should show the error summary when shown', () => {
      const summary = faker.lorem.sentence();
      driver.when.shown(
        new AtlasError(summary, { suggestedActions: faker.lorem.sentence() }),
      );

      expect(driver.get.message()).toBe(
        `Atlas could not start this page: ${summary}`,
      );
    });

    it('should list the suggested actions when shown', () => {
      const actions = [faker.lorem.sentence(), faker.lorem.sentence()];
      driver.when.shown(
        new AtlasError(faker.lorem.sentence(), { suggestedActions: actions }),
      );

      expect(driver.get.actions()).toEqual(actions);
    });

    it('should use the singular heading when one action is suggested', () => {
      driver.when.shown(
        new AtlasError(faker.lorem.sentence(), {
          suggestedActions: faker.lorem.sentence(),
        }),
      );

      expect(driver.get.actionHeading()).toBe('Suggested action');
    });

    it('should use the plural heading when several actions are suggested', () => {
      driver.when.shown(
        new AtlasError(faker.lorem.sentence(), {
          suggestedActions: [faker.lorem.sentence(), faker.lorem.sentence()],
        }),
      );

      expect(driver.get.actionHeading()).toBe('Suggested actions');
    });
  });

  describe('when the error is a plain error', () => {
    it('should show the message without its suggested actions suffix when shown', () => {
      const detail = faker.lorem.sentence();
      driver.when.shown(new Error(`${detail} Suggested actions: 1) retry`));

      expect(driver.get.message()).toBe(
        `Atlas could not start this page: ${detail}`,
      );
    });

    it('should show the stringified value when the error is not an Error', () => {
      const detail = faker.lorem.sentence();
      driver.when.shown(detail);

      expect(driver.get.message()).toBe(
        `Atlas could not start this page: ${detail}`,
      );
    });

    it.each(FALLBACK_ACTIONS)(
      'should suggest actions matching the message when the message is "%s"',
      (message, firstAction) => {
        driver.when.shown(new Error(message));

        expect(driver.get.actions()[0]).toBe(firstAction);
      },
    );
  });

  describe('when the user clears overrides', () => {
    beforeEach(() => {
      driver.when.shown(new Error(faker.lorem.sentence()));
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
