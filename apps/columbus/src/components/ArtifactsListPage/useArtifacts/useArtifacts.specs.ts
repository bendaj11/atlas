import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { UseArtifactsDriver } from './useArtifacts.driver';

describe('useArtifacts', () => {
  let driver: UseArtifactsDriver;

  beforeEach(() => {
    driver = new UseArtifactsDriver();
  });

  it('should return visible only off when rendered', () => {
    driver.when.rendered();

    expect(driver.get.result().visibleOnly).toBe(false);
  });

  it('should return no artifacts when columbus state is missing', () => {
    driver.given.columbusState(undefined).when.rendered();

    expect(driver.get.result().artifacts).toEqual([]);
  });

  it('should list host, apps, and widget providers when columbus state is loaded', () => {
    const host = aHostManifest();
    const app = anAppManifest();
    const provider = anAppManifest();

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

  describe('when an app has no override', () => {
    const app = anAppManifest();

    beforeEach(() => {
      driver.given.catalogApp(app).when.rendered();
    });

    it('should mark the app as not toggleable when rendered', () => {
      expect(driver.get.artifactOf(app).canToggle).toBe(false);
    });

    it('should return no override type for the app when rendered', () => {
      expect(driver.get.artifactOf(app).overrideType).toBeUndefined();
    });

    it('should return an empty source description for the app when rendered', () => {
      expect(driver.get.artifactOf(app).sourceDescription).toBe('');
    });
  });

  describe('when an app has an enabled override', () => {
    const app = anAppManifest();
    const override = anAppManifest();

    beforeEach(() => {
      driver.given.catalogApp(app).given.enabledOverride(app, override);
    });

    it('should mark the app override as enabled when rendered', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).overrideEnabled).toBe(true);
    });

    it('should select the enabled override as the app override version when rendered', () => {
      driver.when.rendered();

      expect(driver.get.artifactOf(app).selectedOverrideArtifactVersion).toBe(
        override,
      );
    });

    it('should select the enabled override as the app override version when a disabled override also exists', () => {
      driver.given.disabledOverride(app, anAppManifest()).when.rendered();

      expect(driver.get.artifactOf(app).selectedOverrideArtifactVersion).toBe(
        override,
      );
    });
  });

  describe('when an app has only a disabled override', () => {
    const app = anAppManifest();

    beforeEach(() => {
      driver.given
        .catalogApp(app)
        .given.disabledOverride(app, anAppManifest())
        .when.rendered();
    });

    it('should mark the app override as disabled when rendered', () => {
      expect(driver.get.artifactOf(app).overrideEnabled).toBe(false);
    });

    it('should mark the app as toggleable when rendered', () => {
      expect(driver.get.artifactOf(app).canToggle).toBe(true);
    });
  });

  describe('when a production app has an enabled override', () => {
    const app = anAppManifest({ channel: 'production' });

    beforeEach(() => {
      driver.given.catalogApp(app);
    });

    it('should return custom override type when the override is local', () => {
      driver.given
        .enabledOverride(app, anAppManifest({ channel: 'local' }))
        .when.rendered();

      expect(driver.get.artifactOf(app).overrideType).toBe('custom');
    });

    it('should return pr override type when the override is a pr version', () => {
      driver.given
        .enabledOverride(app, anAppManifest({ channel: 'pr' }))
        .when.rendered();

      expect(driver.get.artifactOf(app).overrideType).toBe('pr');
    });

    it('should return production override type when the override is another production version', () => {
      driver.given
        .enabledOverride(app, anAppManifest({ channel: 'production' }))
        .when.rendered();

      expect(driver.get.artifactOf(app).overrideType).toBe('production');
    });

    it('should return no override type when the override is the deployed production version', () => {
      driver.given.enabledOverride(app, { ...app }).when.rendered();

      expect(driver.get.artifactOf(app).overrideType).toBeUndefined();
    });

    it('should return the base url as source description when the override is local', () => {
      const baseUrl = `http://localhost:${faker.internet.port()}/${faker.lorem.slug()}`;

      driver.given
        .enabledOverride(
          app,
          anAppManifest({
            channel: 'local',
            remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
          }),
        )
        .when.rendered();

      expect(driver.get.artifactOf(app).sourceDescription).toBe(baseUrl);
    });

    it('should return the pr number label as source description when the override is a pr version without git details', () => {
      const prNumber = faker.number.int({ min: 1, max: 9999 });

      driver.given
        .enabledOverride(
          app,
          anAppManifest({
            channel: 'pr',
            prNumber,
            gitBranch: undefined,
            gitSha: undefined,
            gitCommitTitle: undefined,
          }),
        )
        .when.rendered();

      expect(driver.get.artifactOf(app).sourceDescription).toBe(
        `PR #${prNumber}`,
      );
    });
  });

  describe('when host reports runtime errors', () => {
    const app = anAppManifest();

    beforeEach(() => {
      driver.given.catalogApp(app);
    });

    it('should return the runtime error with a hint as load error when the error targets the app', () => {
      const message = faker.lorem.sentence();

      driver.given.runtimeError(app, message).when.rendered();

      expect(driver.get.artifactOf(app).loadError).toBe(
        `${message} Check override URL and server.`,
      );
    });

    it('should strip the trailing retry prompt from the load error when the error ends with Retry', () => {
      const message = faker.lorem.sentence();

      driver.given.runtimeError(app, `${message} Retry.`).when.rendered();

      expect(driver.get.artifactOf(app).loadError).toBe(
        `${message} Check override URL and server.`,
      );
    });

    it('should return no load error for the app when the error targets another app', () => {
      const other = anAppManifest();

      driver.given
        .catalogApp(other)
        .given.runtimeError(other, faker.lorem.sentence())
        .when.rendered();

      expect(driver.get.artifactOf(app).loadError).toBeUndefined();
    });
  });

  describe('when the catalog has a host and an app', () => {
    const host = aHostManifest();
    const app = anAppManifest();

    beforeEach(() => {
      driver.given.catalogHost(host).given.catalogApp(app);
    });

    it('should mark the host visible when visible app ids are empty', () => {
      driver.given.visibleAppIds([]).when.rendered();

      expect(driver.get.artifactOf(host).visible).toBe(true);
    });

    it('should mark the app visible when its id is among the visible app ids', () => {
      driver.given.visibleAppIds([app.id]).when.rendered();

      expect(driver.get.artifactOf(app).visible).toBe(true);
    });

    it('should mark the app hidden when its id is not among the visible app ids', () => {
      driver.given.visibleAppIds([faker.string.uuid()]).when.rendered();

      expect(driver.get.artifactOf(app).visible).toBe(false);
    });

    it('should mark the app hidden when visible app ids are absent', () => {
      driver.given.visibleAppIds(undefined).when.rendered();

      expect(driver.get.artifactOf(app).visible).toBe(false);
    });

    describe('when the app is hidden and visible only is on', () => {
      beforeEach(() => {
        driver.given.visibleAppIds([]).when.rendered();

        driver.when.visibleOnlyChanged(true);
      });

      it('should return visible only on when changed', () => {
        expect(driver.get.result().visibleOnly).toBe(true);
      });

      it('should drop the hidden app when changed', () => {
        expect(driver.get.deployedArtifactVersions()).toEqual([host]);
      });

      it('should count only visible artifacts as total when changed', () => {
        expect(driver.get.result().totalCount).toBe(1);
      });

      it('should restore the hidden app when visible only is changed back to off', () => {
        driver.when.visibleOnlyChanged(false);

        expect(driver.get.deployedArtifactVersions()).toEqual([host, app]);
      });
    });
  });

  describe('when searching', () => {
    const host = aHostManifest();

    beforeEach(() => {
      driver.given.catalogHost(host);
    });

    it('should keep only the app whose name matches when the search is padded and differs in case', () => {
      const name = faker.string.alpha(10);
      const app = anAppManifest({ name });

      driver.given
        .catalogApp(anAppManifest({ name: faker.string.alpha(10) }))
        .given.catalogApp(app)
        .when.rendered();

      driver.when.searched(`  ${name.toUpperCase()} `);

      expect(driver.get.deployedArtifactVersions()).toEqual([app]);
    });

    it('should keep only the app whose override source description matches when the search hits it', () => {
      const app = anAppManifest();
      const baseUrl = `http://localhost:${faker.internet.port()}/${faker.string.alpha(10)}`;

      driver.given
        .catalogApp(anAppManifest())
        .given.catalogApp(app)
        .given.enabledOverride(
          app,
          anAppManifest({
            channel: 'local',
            remoteEntryUrl: `${baseUrl}/remoteEntry.json`,
          }),
        )
        .when.rendered();

      driver.when.searched(baseUrl);

      expect(driver.get.deployedArtifactVersions()).toEqual([app]);
    });

    it('should keep the total count unfiltered when the search narrows the artifacts', () => {
      const app = anAppManifest();

      driver.given
        .catalogApp(app)
        .given.catalogApp(anAppManifest())
        .when.rendered();

      driver.when.searched(app.name);

      expect(driver.get.result().totalCount).toBe(3);
    });
  });

  describe('when ordering', () => {
    const host = aHostManifest();

    beforeEach(() => {
      driver.given.catalogHost(host);
    });

    it('should order enabled, then disabled, then plain artifacts when ranks differ', () => {
      const plain = anAppManifest();
      const disabled = anAppManifest();
      const enabled = anAppManifest();

      driver.given
        .catalogApp(plain)
        .given.catalogApp(disabled)
        .given.catalogApp(enabled)
        .given.disabledOverride(disabled, anAppManifest())
        .given.enabledOverride(enabled, anAppManifest())
        .when.rendered();

      expect(driver.get.deployedArtifactVersions()).toEqual([
        enabled,
        disabled,
        host,
        plain,
      ]);
    });

    it('should keep catalog order when artifacts share the same rank', () => {
      const first = anAppManifest();
      const second = anAppManifest();

      driver.given.catalogApp(first).given.catalogApp(second).when.rendered();

      expect(driver.get.deployedArtifactVersions()).toEqual([
        host,
        first,
        second,
      ]);
    });
  });
});
