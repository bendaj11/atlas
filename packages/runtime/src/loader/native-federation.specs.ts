import { faker } from '@faker-js/faker';
import { anAppManifest, anExportedWidgetManifest } from '@atlas/testkit';
import { NativeFederationDriver } from './native-federation.driver.js';

const LOCAL_REMOTE_ENTRY_URL = 'http://localhost:4201/remoteEntry.json';

describe('createNativeFederationImporters', () => {
  let driver: NativeFederationDriver;

  beforeEach(() => {
    driver = new NativeFederationDriver();
  });

  describe('when a host remote entry url is configured', () => {
    const hostRemoteEntryUrl =
      'https://cdn.example/hosts/customer-host/1.0.0/build-1/remoteEntry.json';
    const manifest = anAppManifest({ id: 'first', channel: 'production' });

    it('should initialize the remote with the host artifact directory as deployUrl when a remote is imported', async () => {
      driver.given.hostRemoteEntryUrl(hostRemoteEntryUrl).given.importers();

      await driver.when.remoteImported(manifest);

      expect(driver.get.initFederationMock()).toHaveBeenCalledWith(
        { atlas_first: manifest.remoteEntryUrl },
        { deployUrl: 'https://cdn.example/hosts/customer-host/1.0.0/build-1/' },
      );
    });

    it('should initialize the remote with the host artifact directory as deployUrl when the legacy positional arguments are used', async () => {
      driver.given
        .hostRemoteEntryUrl(hostRemoteEntryUrl)
        .given.legacyImporters();

      await driver.when.remoteImported(manifest);

      expect(driver.get.initFederationMock()).toHaveBeenCalledWith(
        { atlas_first: manifest.remoteEntryUrl },
        { deployUrl: 'https://cdn.example/hosts/customer-host/1.0.0/build-1/' },
      );
    });
  });

  describe('when importers are created without a host remote entry url', () => {
    beforeEach(() => {
      driver.given.importers();
    });

    it('should load the exposed entry from the sanitized remote name when a remote is imported', async () => {
      const manifest = anAppManifest({
        id: 'my-app.v2',
        channel: 'production',
      });

      await driver.when.remoteImported(manifest);

      expect(driver.get.loadRemoteModuleMock()).toHaveBeenCalledWith(
        'atlas_my_app_v2',
        manifest.exposes.entry,
      );
    });

    it('should initialize each remote once when two remotes are initialized and imported', async () => {
      const first = anAppManifest({ id: 'first', channel: 'production' });
      const second = anAppManifest({ id: 'second', channel: 'production' });

      await driver.when.initialized([first, second]);
      await driver.when.remoteImported(first);
      await driver.when.remoteImported(second);

      expect(driver.get.initializedRemotes()).toEqual([
        { atlas_first: first.remoteEntryUrl },
        { atlas_second: second.remoteEntryUrl },
      ]);
    });

    it('should reject with ATLAS_APP_MOUNT_EXPORT_MISSING when the remote module has no mount function', async () => {
      driver.given.moduleLoadResults([{ default: {} }]);

      await driver.when.remoteImported(
        anAppManifest({ channel: 'production' }),
      );

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_APP_MOUNT_EXPORT_MISSING',
      });
    });

    it('should return the default export when the remote module wraps the entry in default', async () => {
      const entry = { mount() {} };
      driver.given.moduleLoadResults([{ default: entry }]);

      await driver.when.remoteImported(
        anAppManifest({ channel: 'production' }),
      );

      expect(driver.get.entry()).toBe(entry);
    });

    it('should initialize the widget owner from the widget remote entry when a widget is imported without an owner manifest', async () => {
      const widget = anExportedWidgetManifest({ ownerAppId: 'owner' });

      await driver.when.widgetImported(widget);

      expect(driver.get.initFederationMock()).toHaveBeenCalledWith(
        { atlas_owner: widget.remoteEntryUrl },
        undefined,
      );
    });

    it('should load the widget expose when a widget is imported', async () => {
      const widget = anExportedWidgetManifest({ ownerAppId: 'owner' });

      await driver.when.widgetImported(widget);

      expect(driver.get.loadRemoteModuleMock()).toHaveBeenCalledWith(
        'atlas_owner',
        widget.expose,
      );
    });

    it('should reject with ATLAS_WIDGET_MOUNT_EXPORT_MISSING when the widget module has no mount function', async () => {
      driver.given.moduleLoadResults([{}]);

      await driver.when.widgetImported(anExportedWidgetManifest());

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_WIDGET_MOUNT_EXPORT_MISSING',
      });
    });
  });

  it('should load the remote module on the second attempt when one retry is allowed and the first load fails', async () => {
    const manifest = anAppManifest({ channel: 'production' });
    driver.given
      .retryCount(1)
      .given.moduleLoadResults([new Error('chunk unavailable'), { mount() {} }])
      .given.importers();

    await driver.when.remoteImported(manifest);

    expect(driver.get.loadRemoteModuleMock()).toHaveBeenCalledTimes(2);
  });

  describe('when initialization fails for one of two remotes', () => {
    const healthy = anAppManifest({ id: 'healthy', channel: 'production' });
    const broken = anAppManifest({ id: 'broken', channel: 'production' });

    beforeEach(async () => {
      driver.given
        .initializationFailingFor('atlas_broken', new Error('CDN unavailable'))
        .given.importers();

      await driver.when.initialized([healthy, broken]);
    });

    it('should import the healthy remote when it is imported after initialization', async () => {
      await driver.when.remoteImported(healthy);

      expect(driver.get.error()).toBeUndefined();
    });

    it('should reject with the initialization failure when the broken remote is imported', async () => {
      await driver.when.remoteImported(broken);

      expect(driver.get.error()).toMatchObject({
        message: expect.stringContaining('CDN unavailable'),
      });
    });
  });

  describe('when initialization fails once and succeeds afterwards', () => {
    const manifest = anAppManifest({ channel: 'production' });

    beforeEach(async () => {
      driver.given
        .initializationFailingOnce(new Error('CDN unavailable'))
        .given.importers();

      await driver.when.remoteImported(manifest);
    });

    it('should import the remote when it is imported again', async () => {
      await driver.when.remoteImported(manifest);

      expect(driver.get.error()).toBeUndefined();
    });

    it('should initialize the remote again when it is imported again', async () => {
      await driver.when.remoteImported(manifest);

      expect(driver.get.initFederationMock()).toHaveBeenCalledTimes(2);
    });
  });
});

describe('createTrustedNativeFederationImporters', () => {
  let driver: NativeFederationDriver;

  beforeEach(() => {
    driver = new NativeFederationDriver();
  });

  describe('when one manifest fails trust and one is local', () => {
    const rejected = anAppManifest({
      id: 'rejected',
      channel: 'production',
      remoteEntryUrl: `ftp://${faker.internet.domainName()}/remoteEntry.json`,
    });
    const local = anAppManifest({
      id: 'local',
      channel: 'local',
      remoteEntryUrl: LOCAL_REMOTE_ENTRY_URL,
    });

    beforeEach(async () => {
      await driver.given.trustedImporters([rejected, local]);
    });

    it('should initialize only the trusted remote when both are initialized', async () => {
      await driver.when.initialized([rejected, local]);

      expect(driver.get.initializedRemotes()).toEqual([
        { atlas_local: LOCAL_REMOTE_ENTRY_URL },
      ]);
    });

    it('should reject with ATLAS_REMOTE_TRUST_REJECTED when the rejected remote is imported', async () => {
      await driver.when.remoteImported(rejected);

      expect(driver.get.error()).toMatchObject({
        code: 'ATLAS_REMOTE_TRUST_REJECTED',
      });
    });

    it('should import the local remote when it is imported', async () => {
      await driver.when.remoteImported(local);

      expect(driver.get.entry()).toMatchObject({ mount: expect.any(Function) });
    });
  });

  it('should initialize the owner remote when a widget is imported with its owner manifest', async () => {
    const widget = anExportedWidgetManifest({
      ownerAppId: 'external-provider',
    });
    const owner = anAppManifest({
      id: widget.ownerAppId,
      channel: 'production',
      remoteEntryUrl: widget.remoteEntryUrl,
      exportedWidgets: [widget],
    });
    await driver.given.trustedImporters([]);

    await driver.when.widgetImported(widget, owner);

    expect(driver.get.initializedRemotes()).toEqual([
      { atlas_external_provider: widget.remoteEntryUrl },
    ]);
  });

  it('should reject with ATLAS_WIDGET_OWNER_UNTRUSTED when a widget is imported without a known owner', async () => {
    await driver.given.trustedImporters([]);

    await driver.when.widgetImported(anExportedWidgetManifest());

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_WIDGET_OWNER_UNTRUSTED',
    });
  });

  it('should reject with ATLAS_WIDGET_OWNER_MISMATCH when the owner manifest id differs from ownerAppId', async () => {
    const widget = anExportedWidgetManifest();
    await driver.given.trustedImporters([]);

    await driver.when.widgetImported(
      widget,
      anAppManifest({ channel: 'production' }),
    );

    expect(driver.get.error()).toMatchObject({
      code: 'ATLAS_WIDGET_OWNER_MISMATCH',
    });
  });
});
