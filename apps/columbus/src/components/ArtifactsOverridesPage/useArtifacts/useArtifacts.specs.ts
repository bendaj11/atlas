import { beforeEach, describe, expect, it } from '@jest/globals';
import { aManifest } from '../../../types/app.testkit';
import { getArtifactKey } from '../../../types/contracts';
import { UseArtifactsDriver } from './useArtifacts.driver';

describe('useArtifacts', () => {
  let driver: UseArtifactsDriver;

  beforeEach(() => {
    driver = new UseArtifactsDriver();
  });

  it('should return no artifacts when session is missing', () => {
    driver.given.noSession().when.rendered();

    expect(driver.get.artifacts()).toEqual([]);
  });

  it('should list host, apps, and widget providers when session is loaded', () => {
    const app = driver.given.app();
    const provider = driver.given.widgetProvider();

    driver.when.rendered();

    expect(driver.get.artifactIds()).toEqual(
      [driver.get.host(), app, provider].map(getArtifactKey),
    );
  });

  describe('when artifact has no override', () => {
    it('should mark artifact as not toggleable when no override exists', () => {
      const app = driver.given.app();

      driver.when.rendered();

      expect(driver.get.artifact(app).canToggle).toBe(false);
    });

    it('should report override type none when no override exists', () => {
      const app = driver.given.app();

      driver.when.rendered();

      expect(driver.get.artifact(app).overrideType).toBe('none');
    });
  });

  describe('when artifact has an active override', () => {
    it('should enable override when override is active', () => {
      const app = driver.given.app();
      const override = aManifest({ channel: 'pr' });

      driver.given.activeOverride(app, override).when.rendered();

      expect(driver.get.artifact(app).overrideEnabled).toBe(true);
    });

    it('should select active override manifest when override is active', () => {
      const app = driver.given.app();
      const override = aManifest({ channel: 'pr' });

      driver.given.activeOverride(app, override).when.rendered();

      expect(driver.get.artifact(app).selectedManifest).toBe(override);
    });

    it('should prefer active override when both active and disabled exist', () => {
      const app = driver.given.app();
      const active = aManifest({ channel: 'pr' });
      const disabled = aManifest({ channel: 'local' });

      driver.given
        .activeOverride(app, active)
        .given.disabledOverride(app, disabled)
        .when.rendered();

      expect(driver.get.artifact(app).selectedManifest).toBe(active);
    });
  });

  describe('when artifact has a disabled override', () => {
    it('should keep override disabled when override is only disabled', () => {
      const app = driver.given.app();
      const override = aManifest({ channel: 'local' });

      driver.given.disabledOverride(app, override).when.rendered();

      expect(driver.get.artifact(app).overrideEnabled).toBe(false);
    });

    it('should allow toggling when override is disabled', () => {
      const app = driver.given.app();
      const override = aManifest({ channel: 'local' });

      driver.given.disabledOverride(app, override).when.rendered();

      expect(driver.get.artifact(app).canToggle).toBe(true);
    });
  });

  describe('when host reports runtime errors', () => {
    it('should attach load error with hint when runtime error targets the artifact', () => {
      const app = driver.given.app();

      driver.given
        .runtimeError(app, 'Failed to fetch remote entry.')
        .when.rendered();

      expect(driver.get.artifact(app).loadError).toBe(
        'Failed to fetch remote entry. Check override URL and server.',
      );
    });

    it('should strip trailing retry prompt when runtime error ends with Retry', () => {
      const app = driver.given.app();

      driver.given
        .runtimeError(app, 'Failed to fetch remote entry. Retry.')
        .when.rendered();

      expect(driver.get.artifact(app).loadError).toBe(
        'Failed to fetch remote entry. Check override URL and server.',
      );
    });

    it('should leave load error undefined when runtime error targets another artifact', () => {
      const app = driver.given.app();
      const other = driver.given.app();

      driver.given.runtimeError(other, 'Broken.').when.rendered();

      expect(driver.get.artifact(app).loadError).toBeUndefined();
    });
  });

  describe('when host lists visible app ids', () => {
    it('should mark host visible when host is always visible', () => {
      driver.given.visibleAppIds().when.rendered();

      expect(driver.get.artifact(driver.get.host()).visible).toBe(true);
    });

    it('should mark app visible when its id is listed', () => {
      const app = driver.given.app();

      driver.given.visibleAppIds(app.id).when.rendered();

      expect(driver.get.artifact(app).visible).toBe(true);
    });

    it('should mark app hidden when its id is not listed', () => {
      const app = driver.given.app();

      driver.given.visibleAppIds().when.rendered();

      expect(driver.get.artifact(app).visible).toBe(false);
    });

    it('should mark app hidden when visible app ids are absent', () => {
      const app = driver.given.app();

      driver.when.rendered();

      expect(driver.get.artifact(app).visible).toBe(false);
    });
  });

  describe('when visibleOnly is toggled on', () => {
    it('should start with visibleOnly off when rendered', () => {
      driver.when.rendered();

      expect(driver.get.visibleOnly()).toBe(false);
    });

    it('should drop hidden apps when visibleOnly is on', () => {
      driver.given.app();

      driver.when.rendered().when.visibleOnlyToggled();

      expect(driver.get.artifactIds()).toEqual([
        getArtifactKey(driver.get.host()),
      ]);
    });

    it('should count only visible artifacts as total when visibleOnly is on', () => {
      driver.given.app();

      driver.when.rendered().when.visibleOnlyToggled().when.searched('none');

      expect(driver.get.totalCount()).toBe(1);
    });

    it('should restore hidden apps when visibleOnly is toggled off again', () => {
      const app = driver.given.app();

      driver.when
        .rendered()
        .when.visibleOnlyToggled()
        .when.visibleOnlyToggled();

      expect(driver.get.artifactIds()).toContain(getArtifactKey(app));
    });
  });

  describe('when searching', () => {
    it('should match name case-insensitively when search has padding', () => {
      driver.given.app({ name: 'Cart' });
      const orders = driver.given.app({ name: 'Orders' });

      driver.when.rendered().when.searched('  oRdErS ');

      expect(driver.get.artifactIds()).toEqual([getArtifactKey(orders)]);
    });

    it('should match override source when search hits it', () => {
      driver.given.app();
      const app = driver.given.app();
      const override = aManifest({
        channel: 'local',
        remoteEntryUrl: 'http://localhost:4200/remoteEntry.json',
      });

      driver.given
        .activeOverride(app, override)
        .when.rendered()
        .when.searched('localhost');

      expect(driver.get.artifactIds()).toEqual([getArtifactKey(app)]);
    });

    it('should keep total count unfiltered when search narrows results', () => {
      driver.given.app({ name: 'Alpha' });
      driver.given.app({ name: 'Beta' });

      driver.when.rendered().when.searched('alpha');

      expect(driver.get.totalCount()).toBe(3);
    });
  });

  describe('when ordering', () => {
    it('should order enabled overrides before disabled before plain artifacts', () => {
      const plain = driver.given.app();
      const disabled = driver.given.app();
      const enabled = driver.given.app();

      driver.given
        .disabledOverride(disabled, aManifest({ channel: 'pr' }))
        .given.activeOverride(enabled, aManifest({ channel: 'pr' }))
        .when.rendered();

      expect(driver.get.artifactIds()).toEqual(
        [enabled, disabled, driver.get.host(), plain].map(getArtifactKey),
      );
    });

    it('should keep catalog order when artifacts share the same rank', () => {
      const first = driver.given.app();
      const second = driver.given.app();

      driver.when.rendered();

      expect(driver.get.artifactIds()).toEqual(
        [driver.get.host(), first, second].map(getArtifactKey),
      );
    });
  });
});
