import { aManifest, aSession } from '../../../types/app.testkit';
import { OverridesContextDriver } from './OverridesContext.driver';

describe('OverridesProvider', () => {
  let driver: OverridesContextDriver;

  beforeEach(() => {
    driver = new OverridesContextDriver();
  });

  describe('when exposing session state', () => {
    it('should start idle when rendered', () => {
      driver.when.rendered();

      expect(driver.get.status()).toBe('IDLE');
    });

    it('should report no overrides when session is missing', () => {
      driver.given.session(undefined).when.rendered();

      expect(driver.get.hasOverrides()).toBe(false);
    });

    it('should report no overrides when session has none', () => {
      driver.when.rendered();

      expect(driver.get.hasOverrides()).toBe(false);
    });

    it('should report overrides when session has an active override', () => {
      driver.given
        .session(
          aSession({ activeOverrides: new Map([['app:orders', aManifest()]]) }),
        )
        .when.rendered();

      expect(driver.get.hasOverrides()).toBe(true);
    });

    it('should report overrides when session has a disabled override', () => {
      driver.given
        .session(
          aSession({
            disabledOverrides: new Map([['app:orders', aManifest()]]),
          }),
        )
        .when.rendered();

      expect(driver.get.hasOverrides()).toBe(true);
    });

    it('should use session scope when session exists', () => {
      driver.given.session(aSession({ scope: 'tab' })).when.rendered();

      expect(driver.get.scope()).toBe('tab');
    });

    it('should default scope to all when session is missing', () => {
      driver.given.session(undefined).when.rendered();

      expect(driver.get.scope()).toBe('all');
    });
  });

  describe('when toggling an override', () => {
    it('should toggle the artifact in the session when toggled', async () => {
      await driver.when.rendered().when.overrideToggled('app:orders');

      expect(driver.get.toggleRequest()?.artifactKey).toBe('app:orders');
    });

    it('should store the next session when toggled', async () => {
      await driver.when.rendered().when.overrideToggled('app:orders');

      expect(driver.get.storedSession()).toBe(driver.get.nextSession());
    });

    it('should persist the next session when toggled', async () => {
      await driver.when.rendered().when.overrideToggled('app:orders');

      expect(driver.get.persistedSession()).toBe(driver.get.nextSession());
    });

    it('should close the window when persisting succeeds', async () => {
      await driver.when.rendered().when.overrideToggled('app:orders');

      expect(driver.get.windowCloseCount()).toBe(1);
    });

    it('should do nothing when session is missing', async () => {
      await driver.given
        .session(undefined)
        .when.rendered()
        .when.overrideToggled('app:orders');

      expect(driver.get.persistCount()).toBe(0);
    });

    it('should do nothing when artifact has no override to toggle', async () => {
      await driver.given
        .toggleResult(undefined)
        .when.rendered()
        .when.overrideToggled('app:orders');

      expect(driver.get.persistCount()).toBe(0);
    });

    it('should report applying while persisting is pending', () => {
      driver.given
        .persistPending()
        .when.rendered()
        .when.overrideToggleStarted('app:orders');

      expect(driver.get.status()).toBe('APPLYING');
    });

    it('should ignore a second action while persisting is pending', async () => {
      await driver.given
        .persistPending()
        .when.rendered()
        .when.overrideToggleStarted('app:orders')
        .when.overrideToggled('app:cart');

      expect(driver.get.persistCount()).toBe(1);
    });

    it('should report error when persisting fails', async () => {
      await driver.given
        .persistFailure('Host tab gone.')
        .when.rendered()
        .when.overrideToggled('app:orders');

      expect(driver.get.status()).toBe('ERROR');
    });

    it('should explain the failure when persisting fails', async () => {
      await driver.given
        .persistFailure('Host tab gone.')
        .when.rendered()
        .when.overrideToggled('app:orders');

      expect(driver.get.message()).toContain('Host tab gone.');
    });

    it('should keep the window open when persisting fails', async () => {
      await driver.given
        .persistFailure('Host tab gone.')
        .when.rendered()
        .when.overrideToggled('app:orders');

      expect(driver.get.windowCloseCount()).toBe(0);
    });
  });

  describe('when saving an override', () => {
    const selection = {
      productionManifest: aManifest(),
      selectedManifest: aManifest(),
    };

    it('should save the selection in the session when saved', async () => {
      await driver.when.rendered().when.overrideSaved(selection);

      expect(driver.get.saveRequest()?.selection).toBe(selection);
    });

    it('should persist the next session when saved', async () => {
      await driver.when.rendered().when.overrideSaved(selection);

      expect(driver.get.persistedSession()).toBe(driver.get.nextSession());
    });
  });

  describe('when clearing overrides', () => {
    it('should clear the artifact in the session when one override is cleared', async () => {
      await driver.when.rendered().when.overrideCleared('app:orders');

      expect(driver.get.clearRequest()?.artifactKey).toBe('app:orders');
    });

    it('should persist the next session when one override is cleared', async () => {
      await driver.when.rendered().when.overrideCleared('app:orders');

      expect(driver.get.persistedSession()).toBe(driver.get.nextSession());
    });

    it('should clear the session when all overrides are cleared', async () => {
      const session = aSession();

      await driver.given
        .session(session)
        .when.rendered()
        .when.allOverridesCleared();

      expect(driver.get.clearAllRequest()).toBe(session);
    });

    it('should persist the next session when all overrides are cleared', async () => {
      await driver.when.rendered().when.allOverridesCleared();

      expect(driver.get.persistedSession()).toBe(driver.get.nextSession());
    });
  });

  describe('when changing scope', () => {
    it('should update the session scope when scope is set', () => {
      const session = aSession();

      driver.given.session(session).when.rendered().when.scopeSet('tab');

      expect(driver.get.storedSessionUpdate(session)).toBe(
        driver.get.nextSession(),
      );
    });

    it('should keep the session missing when scope is set without a session', () => {
      driver.given.session(undefined).when.rendered().when.scopeSet('tab');

      expect(driver.get.storedSessionUpdate(undefined)).toBeUndefined();
    });

    it('should not persist when scope is set', () => {
      driver.when.rendered().when.scopeSet('tab');

      expect(driver.get.persistCount()).toBe(0);
    });
  });

  describe('when reporting an error', () => {
    it('should report error status when an error is reported', () => {
      driver.when.rendered().when.errorReported('Boom');

      expect(driver.get.status()).toBe('ERROR');
    });

    it('should expose the message when an error is reported', () => {
      driver.when.rendered().when.errorReported('Boom');

      expect(driver.get.message()).toBe('Boom');
    });
  });
});
