import {
  aHostArtifactVersion,
  anAppArtifactVersion,
} from '../../../types/app.testkit';
import { PageRuntimeStateDriver } from './page-runtime-state.driver';

const DOCUMENT = JSON.stringify({
  schemaVersion: '1',
  hostId: 'shop',
  overrides: [],
  generatedAt: '2026-01-01T00:00:00.000Z',
});

describe('readStoredOverrides', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should return nothing when no document is stored', () => {
    driver.when.storedOverridesRead('shop');

    expect(driver.get.stored()).toEqual({
      overrides: undefined,
      overrideScope: undefined,
    });
  });

  it('should read the document with scope all when it is in local storage', () => {
    driver.given.pageLocalStorage(DOCUMENT).when.storedOverridesRead('shop');

    expect(driver.get.stored()).toMatchObject({
      overrides: { hostId: 'shop' },
      overrideScope: 'all',
    });
  });

  it('should read the document with scope tab when it is in session storage', () => {
    driver.given.pageSessionStorage(DOCUMENT).when.storedOverridesRead('shop');

    expect(driver.get.stored()?.overrideScope).toBe('tab');
  });

  it('should prefer session storage when both storages hold a document', () => {
    driver.given
      .pageLocalStorage(DOCUMENT)
      .given.pageSessionStorage(DOCUMENT)
      .when.storedOverridesRead('shop');

    expect(driver.get.stored()?.overrideScope).toBe('tab');
  });

  it('should drop the document when it belongs to another host', () => {
    driver.given.pageLocalStorage(DOCUMENT).when.storedOverridesRead('other');

    expect(driver.get.stored()?.overrides).toBeUndefined();
  });

  it('should keep the scope when the stored value is not json', () => {
    driver.given.pageLocalStorage('{oops').when.storedOverridesRead('shop');

    expect(driver.get.stored()).toEqual({
      overrides: undefined,
      overrideScope: 'all',
    });
  });
});

describe('localOverridesOf', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should return nothing when no manifest is local', () => {
    driver.when.localOverridesBuilt('shop', [
      anAppArtifactVersion({ channel: 'production' }),
    ]);

    expect(driver.get.localOverrides()).toBeUndefined();
  });

  it('should list local apps as overrides when apps are local', () => {
    const local = anAppArtifactVersion({ id: 'orders', channel: 'local' });

    driver.when.localOverridesBuilt('shop', [
      anAppArtifactVersion({ channel: 'production' }),
      local,
    ]);

    expect(driver.get.localOverrides()?.overrides).toEqual([
      { appId: 'orders', manifest: local, reason: 'local' },
    ]);
  });

  it('should set the host override when the host is local', () => {
    const host = aHostArtifactVersion({ channel: 'local' });

    driver.when.localOverridesBuilt('shop', [host]);

    expect(driver.get.localOverrides()?.hostOverride).toBe(host);
  });
});

describe('readRuntimeErrors', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should attribute the error to the app when the element carries an app id', () => {
    driver.given
      .pageBody(
        '<div data-atlas-state="error" data-atlas-app-id="orders">Unable to load Orders.</div>',
      )
      .when.runtimeErrorsRead();

    expect(driver.get.runtimeErrors()).toEqual([
      { artifactId: 'app:orders', message: 'Unable to load Orders.' },
    ]);
  });

  it('should report an unattributed error when the element has no app id', () => {
    driver.given
      .pageBody('<div data-atlas-state="error">Boom</div>')
      .when.runtimeErrorsRead();

    expect(driver.get.runtimeErrors()).toEqual([{ message: 'Boom' }]);
  });

  it('should use a fallback message when the element is empty', () => {
    driver.given
      .pageBody('<div data-atlas-state="error"></div>')
      .when.runtimeErrorsRead();

    expect(driver.get.runtimeErrors()).toEqual([
      { message: 'Unknown app error' },
    ]);
  });
});

describe('readVisibleAppIds', () => {
  let driver: PageRuntimeStateDriver;

  beforeEach(() => {
    driver = new PageRuntimeStateDriver();
  });

  it('should list each app once when containers repeat', () => {
    driver.given
      .pageBody(
        '<div data-atlas-app-id="orders"></div><div data-atlas-app-id="orders"></div><div data-atlas-app-id="billing"></div>',
      )
      .when.visibleAppIdsRead();

    expect(driver.get.visibleAppIds()).toEqual(['orders', 'billing']);
  });

  it('should list nothing when no containers exist', () => {
    driver.when.visibleAppIdsRead();

    expect(driver.get.visibleAppIds()).toEqual([]);
  });
});
