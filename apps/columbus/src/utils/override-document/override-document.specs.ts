import { faker } from '@faker-js/faker';
import { aHostManifest, anAppManifest } from '@atlas/testkit';
import { loadBrowserRuntimeOverrides } from '../../../../../../packages/runtime/src/loader/overrides/overrides';
import { aHostData } from '../../../testkit/host-data.testkit';
import {
  countOverrides,
  createOverrideDocument,
  isStoredManifest,
  isStoredOverrideDocument,
} from './override-document';

const REASON_BY_CHANNEL = [
  ['local', 'local'],
  ['pr', 'pr'],
  ['production', 'historical'],
] as const;

describe('createOverrideDocument', () => {
  it('should use the host id of the host data when created', () => {
    const hostData = aHostData();

    expect(
      createOverrideDocument({ hostData, overrides: new Map() }).hostId,
    ).toBe(hostData.config.hostId);
  });

  it.each(REASON_BY_CHANNEL)(
    'should list the app override with its reason when the app channel is %s',
    (channel, reason) => {
      const app = anAppManifest({ channel });

      expect(
        createOverrideDocument({
          hostData: aHostData(),
          overrides: new Map([[app.id, app]]),
        }).overrides,
      ).toStrictEqual([{ appId: app.id, manifest: app, reason }]);
    },
  );

  it('should set the host override when a host is overridden', () => {
    const host = aHostManifest();

    expect(
      createOverrideDocument({
        hostData: aHostData(),
        overrides: new Map([[host.id, host]]),
      }).hostOverride,
    ).toBe(host);
  });

  it('should omit the host override when only apps are overridden', () => {
    const app = anAppManifest();

    expect(
      createOverrideDocument({
        hostData: aHostData(),
        overrides: new Map([[app.id, app]]),
      }).hostOverride,
    ).toBeUndefined();
  });

  it('should produce a document the runtime loader accepts when a local override exists', async () => {
    const hostData = aHostData();
    const app = anAppManifest({ channel: 'local' });
    const document = createOverrideDocument({
      hostData,
      overrides: new Map([[app.id, app]]),
    });

    await expect(
      loadBrowserRuntimeOverrides({
        hostId: hostData.config.hostId,
        search: '',
        sessionStorage: {
          getItem: (key: string) =>
            key === 'atlas.runtime-overrides' ? JSON.stringify(document) : null,
        },
      }),
    ).resolves.toStrictEqual([
      { appId: app.id, manifest: app, reason: 'local' },
    ]);
  });
});

describe('countOverrides', () => {
  it('should count the app overrides when there is no host override', () => {
    expect(countOverrides({ overrides: [{}, {}] })).toBe(2);
  });

  it('should count the host override too when there is one', () => {
    expect(countOverrides({ overrides: [{}, {}], hostOverride: {} })).toBe(3);
  });
});

describe('isStoredOverrideDocument', () => {
  it('should accept the document when created by createOverrideDocument', () => {
    const app = anAppManifest();
    const document = createOverrideDocument({
      hostData: aHostData(),
      overrides: new Map([[app.id, app]]),
    });

    expect(isStoredOverrideDocument(document)).toBe(true);
  });

  it('should reject the document when an override app id differs from its manifest id', () => {
    const app = anAppManifest();
    const document = createOverrideDocument({
      hostData: aHostData(),
      overrides: new Map([[app.id, app]]),
    });

    expect(
      isStoredOverrideDocument({
        ...document,
        overrides: [{ ...document.overrides[0], appId: faker.string.uuid() }],
      }),
    ).toBe(false);
  });

  it('should reject the document when the host override is not a manifest', () => {
    const document = createOverrideDocument({
      hostData: aHostData(),
      overrides: new Map(),
    });

    expect(isStoredOverrideDocument({ ...document, hostOverride: {} })).toBe(
      false,
    );
  });

  it('should reject the value when it is not a record', () => {
    expect(isStoredOverrideDocument(null)).toBe(false);
  });
});

describe('isStoredManifest', () => {
  it('should accept the manifest when built by the testkit', () => {
    expect(isStoredManifest(anAppManifest())).toBe(true);
  });

  it('should reject the manifest when its kind is unknown', () => {
    expect(
      isStoredManifest({ ...anAppManifest(), kind: faker.word.noun() }),
    ).toBe(false);
  });
});
