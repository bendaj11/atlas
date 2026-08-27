import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { AtlasHostDriver } from './atlas-host.driver.js';
import { errorMessage } from './atlas-host.js';

it('should replace terminal guidance when a CLI-shaped error reaches Columbus', () => {
  const message = errorMessage(
    new Error('Runtime unavailable. Suggested action: Run atlas --help.'),
    'inspect the active host page',
    'Activate the Atlas host tab, then retry.',
  );

  expect({
    hasColumbusContext: message.includes(
      'Columbus could not inspect the active host page: Runtime unavailable.',
    ),
    hasRelevantAction: message.includes(
      'Suggested action: Activate the Atlas host tab, then retry.',
    ),
    hasTerminalGuidance: message.includes('atlas --help'),
  }).toStrictEqual({
    hasColumbusContext: true,
    hasRelevantAction: true,
    hasTerminalGuidance: false,
  });
});

describe('active Atlas host selection', () => {
  let driver: AtlasHostDriver;

  beforeEach(() => {
    driver = new AtlasHostDriver();
  });

  afterEach(() => driver.dispose());

  it('should select active tab when active tab contains Atlas host', async () => {
    driver.given
      .tabs({ id: 7, active: true, url: 'http://127.0.0.1:4300/orders' })
      .given.inspectedHost(7);

    await driver.when.hostDataRead();

    expect(driver.get.tabId()).toBe(7);
  });

  it('should cache host data when active Atlas tab is inspected', async () => {
    driver.given
      .tabs({ id: 7, active: true, url: 'http://127.0.0.1:4300/orders' })
      .given.inspectedHost(7);

    await driver.when.hostDataRead();

    await expect(driver.get.cachedHostData()).resolves.toMatchObject({
      tabId: 7,
    });
  });

  it('should select recent host when Columbus is active tab', async () => {
    driver.given
      .tabs(
        {
          id: 9,
          active: true,
          lastAccessed: 30,
          url: 'chrome-extension://atlas/index.html',
        },
        {
          id: 7,
          active: false,
          lastAccessed: 20,
          url: 'http://127.0.0.1:4300/orders',
        },
      )
      .given.inspectedHost(7);

    await driver.when.hostDataRead();

    expect(driver.get.tabId()).toBe(7);
  });

  it('should select open preview when app framework tab is active', async () => {
    driver.given
      .tabs(
        { id: 8, active: true, url: 'http://localhost:4201/' },
        { id: 7, active: false, url: 'http://localhost:4300/orders' },
      )
      .given.inspectedHost(7);

    await driver.when.hostDataRead();

    expect(driver.get.tabId()).toBe(7);
  });

  it('should not scan other tabs when active page is non-local', async () => {
    driver.given
      .tabs(
        { id: 8, active: true, url: 'https://example.com/' },
        { id: 7, active: false, url: 'http://127.0.0.1:4300/orders' },
      )
      .given.inspectedHost(7);

    await driver.when.hostDataRead();

    expect(driver.get.inspectionCount()).toBe(1);
  });

  it('should report ambiguity when multiple local previews are open', async () => {
    driver.given
      .tabs(
        { id: 9, active: true, url: 'http://localhost:4201/' },
        { id: 8, active: false, url: 'http://localhost:4301/orders' },
        { id: 7, active: false, url: 'http://localhost:4300/orders' },
      )
      .given.inspectedHost(8, '399e1a5d-f83d-4248-96ed-e4211707ae1b')
      .given.inspectedHost(7);

    await driver.when.hostDataRead();

    expect(driver.get.error()).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('Multiple local Atlas previews'),
      }),
    );
  });
});

describe('browser runtime override document', () => {
  let driver: AtlasHostDriver;

  beforeEach(() => {
    driver = new AtlasHostDriver();
  });

  afterEach(() => driver.dispose());

  it('should expose local manifest when custom URL override is written', async () => {
    await expect(driver.get.runtimeOverrides()).resolves.toEqual([
      expect.objectContaining({
        appId: 'orders',
        reason: 'local',
        manifest: expect.objectContaining({
          remoteEntryUrl: 'http://localhost:4513/remoteEntry.json',
        }),
      }),
    ]);
  });

  it('should preserve empty document while local override is suppressed', async () => {
    expect(await driver.get.localSuppressionDocument()).toMatchObject({
      hostId: '060a7f62-1c95-402c-9993-55749faf36d9',
      overrides: [],
    });
  });
});

describe('local override validation', () => {
  let driver: AtlasHostDriver;

  beforeEach(() => {
    driver = new AtlasHostDriver();
  });

  afterEach(() => driver.dispose());

  it('should accept local override when extension can load federation metadata', async () => {
    driver.given.validLocalRemoteEntry();

    await driver.when.localOverrideValidated();

    expect(driver.get.validationError()).toBeUndefined();
  });

  it('should reject local override when extension cannot reach remote entry', async () => {
    driver.given.unreachableLocalRemoteEntry();

    await driver.when.localOverrideValidated();

    expect(driver.get.validationError()).toEqual(
      new Error(
        'Local override remote entry is unreachable. Start its development server, then retry.',
      ),
    );
  });
});
