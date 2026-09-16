import {
  aHostArtifactVersion,
  anAppArtifactVersion,
} from '../../../types/artifact-version.testkit';
import { UseArtifactsDriver } from './useArtifacts.driver';

describe('useArtifacts', () => {
  let driver: UseArtifactsDriver;

  beforeEach(() => {
    driver = new UseArtifactsDriver();
  });

  it('should return no artifacts when columbusState is missing', () => {
    driver.given.columbusState(undefined).when.rendered();

    expect(driver.get.artifacts()).toEqual([]);
  });

  it('should list host, apps, and widget providers when columbusState is loaded', () => {
    const host = aHostArtifactVersion();
    const app = anAppArtifactVersion();
    const provider = anAppArtifactVersion();

    driver.given
      .catalogHost(host)
      .given.catalogApp(app)
      .given.catalogWidgetProvider(provider)
      .when.rendered();

    expect(driver.get.deployedArtifactVersions()).toEqual([
      host,
      app,
      provider,
    ]);
  });

  describe('when artifact has no override', () => {
    const app = anAppArtifactVersion();

    beforeEach(() => {
      driver.given.catalogApp(app);
    });

    it('should mark artifact as not toggleable when no override exists', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).canToggle).toBe(false);
    });

    it('should report no override type when no override exists', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).overrideType).toBeUndefined();
    });
  });

  describe('when artifact has an active override', () => {
    const app = anAppArtifactVersion();
    const override = anAppArtifactVersion({ channel: 'pr' });

    beforeEach(() => {
      driver.given.catalogApp(app).given.activeOverride(app, override);
    });

    it('should enable override when override is active', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).overrideEnabled).toBe(true);
    });

    it('should select active override manifest when override is active', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).selectedArtifactVersion).toBe(override);
    });

    it('should prefer active override when a disabled override also exists', () => {
      driver.given
        .disabledOverride(app, anAppArtifactVersion({ channel: 'local' }))
        .when.rendered();

      expect(driver.get.artifactOf(app).selectedArtifactVersion).toBe(override);
    });
  });

  describe('when artifact has a disabled override', () => {
    const app = anAppArtifactVersion();

    beforeEach(() => {
      driver.given
        .catalogApp(app)
        .given.disabledOverride(
          app,
          anAppArtifactVersion({ channel: 'local' }),
        );
    });

    it('should keep override disabled when override is only disabled', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).overrideEnabled).toBe(false);
    });

    it('should allow toggling when override is disabled', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).canToggle).toBe(true);
    });
  });

  describe('when host reports runtime errors', () => {
    const app = anAppArtifactVersion();

    beforeEach(() => {
      driver.given.catalogApp(app);
    });

    it('should attach load error with hint when runtime error targets the artifact', () => {
      driver.given
        .runtimeError(app, 'Failed to fetch remote entry.')
        .when.rendered();

      expect(driver.get.artifactOf(app).loadError).toBe(
        'Failed to fetch remote entry. Check override URL and server.',
      );
    });

    it('should strip trailing retry prompt when runtime error ends with Retry', () => {
      driver.given
        .runtimeError(app, 'Failed to fetch remote entry. Retry.')
        .when.rendered();

      expect(driver.get.artifactOf(app).loadError).toBe(
        'Failed to fetch remote entry. Check override URL and server.',
      );
    });

    it('should leave load error undefined when runtime error targets another artifact', () => {
      const other = anAppArtifactVersion();

      driver.given
        .catalogApp(other)
        .given.runtimeError(other, 'Broken.')
        .when.rendered();

      expect(driver.get.artifactOf(app).loadError).toBeUndefined();
    });
  });

  describe('when host lists visible app ids', () => {
    const host = aHostArtifactVersion();
    const app = anAppArtifactVersion({ id: 'orders' });

    beforeEach(() => {
      driver.given.catalogHost(host).given.catalogApp(app);
    });

    it('should mark host visible when host is always visible', () => {
      driver.given.visibleAppIds([]).when.rendered();

      expect(driver.get.artifactOf(host).visible).toBe(true);
    });

    it('should mark app visible when its id is listed', () => {
      driver.given.visibleAppIds(['orders']).when.rendered();

      expect(driver.get.artifactOf(app).visible).toBe(true);
    });

    it('should mark app hidden when its id is not listed', () => {
      driver.given.visibleAppIds([]).when.rendered();

      expect(driver.get.artifactOf(app).visible).toBe(false);
    });

    it('should mark app hidden when visible app ids are absent', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).visible).toBe(false);
    });
  });

  describe('when visibleOnly is toggled on', () => {
    const host = aHostArtifactVersion();
    const app = anAppArtifactVersion();

    beforeEach(() => {
      driver.given.catalogHost(host).given.catalogApp(app);
    });

    it('should start with visibleOnly off when rendered', () => {
      driver.when.rendered();

      expect(driver.get.visibleOnly()).toBe(false);
    });

    it('should drop hidden apps when visibleOnly is on', () => {
      driver.when.rendered();

      driver.when.visibleOnlyToggled();

      expect(driver.get.deployedArtifactVersions()).toEqual([host]);
    });

    it('should count only visible artifacts as total when visibleOnly is on', () => {
      driver.when.rendered();
      driver.when.visibleOnlyToggled();

      driver.when.searched('none');

      expect(driver.get.totalCount()).toBe(1);
    });

    it('should restore hidden apps when visibleOnly is toggled off again', () => {
      driver.when.rendered();

      driver.when.visibleOnlyToggled();

      driver.when.visibleOnlyToggled();

      expect(driver.get.deployedArtifactVersions()).toEqual([host, app]);
    });
  });

  describe('when searching', () => {
    it('should match name case-insensitively when search has padding', () => {
      const orders = anAppArtifactVersion({ name: 'Orders' });

      driver.given
        .catalogApp(anAppArtifactVersion({ name: 'Cart' }))
        .given.catalogApp(orders)
        .when.rendered();

      driver.when.searched('  oRdErS ');

      expect(driver.get.deployedArtifactVersions()).toEqual([orders]);
    });

    it('should match override source when search hits it', () => {
      const app = anAppArtifactVersion();

      driver.given
        .catalogApp(anAppArtifactVersion())
        .given.catalogApp(app)
        .given.activeOverride(
          app,
          anAppArtifactVersion({
            channel: 'local',
            remoteEntryUrl: 'http://localhost:4200/remoteEntry.json',
          }),
        )
        .when.rendered();

      driver.when.searched('localhost');

      expect(driver.get.deployedArtifactVersions()).toEqual([app]);
    });

    it('should keep total count unfiltered when search narrows results', () => {
      driver.given
        .catalogApp(anAppArtifactVersion({ name: 'Alpha' }))
        .given.catalogApp(anAppArtifactVersion({ name: 'Beta' }))
        .when.rendered();

      driver.when.searched('alpha');

      expect(driver.get.totalCount()).toBe(3);
    });
  });

  describe('when ordering', () => {
    const host = aHostArtifactVersion();

    beforeEach(() => {
      driver.given.catalogHost(host);
    });

    it('should order enabled, then disabled, then plain artifacts when ranks differ', () => {
      const plain = anAppArtifactVersion();
      const disabled = anAppArtifactVersion();
      const enabled = anAppArtifactVersion();

      driver.given
        .catalogApp(plain)
        .given.catalogApp(disabled)
        .given.catalogApp(enabled)
        .given.disabledOverride(
          disabled,
          anAppArtifactVersion({ channel: 'pr' }),
        )
        .given.activeOverride(enabled, anAppArtifactVersion({ channel: 'pr' }))
        .when.rendered();

      expect(driver.get.deployedArtifactVersions()).toEqual([
        enabled,
        disabled,
        host,
        plain,
      ]);
    });

    it('should keep catalog order when artifacts share the same rank', () => {
      const first = anAppArtifactVersion();
      const second = anAppArtifactVersion();

      driver.given.catalogApp(first).given.catalogApp(second).when.rendered();

      expect(driver.get.deployedArtifactVersions()).toEqual([
        host,
        first,
        second,
      ]);
    });
  });
});
