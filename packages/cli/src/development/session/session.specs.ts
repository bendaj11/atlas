import { faker } from '@faker-js/faker';
import { aHostCatalog, aHostManifest, anAppManifest } from '@atlas/testkit';
import { anOverrideDocument } from '@atlas/testkit/internal';
import { createDevSessionStore } from './session.js';

describe('createDevSessionStore', () => {
  describe('when a ready app registration is served for its host', () => {
    const hostId = faker.string.uuid();
    const generatedAt = faker.date.past().toISOString();
    const manifest = anAppManifest();
    const document = anOverrideDocument({
      hostId,
      generatedAt,
      overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
    });
    const publishedCatalog = aHostCatalog({ hostId });

    it('should offer the app under the generation time of its registration when served', () => {
      const store = createDevSessionStore(document, faker.internet.url());

      store.markReady(manifest.id, hostId);

      expect(store.devSession(hostId, publishedCatalog)?.offerIds).toStrictEqual(
        { [manifest.id]: generatedAt },
      );
    });

    it('should serve the published catalog unchanged when one is given', () => {
      const store = createDevSessionStore(document, faker.internet.url());

      store.markReady(manifest.id, hostId);

      expect(store.devSession(hostId, publishedCatalog)?.catalog).toBe(
        publishedCatalog,
      );
    });

    it('should serve the override url the store was created with when served', () => {
      const overrideUrl = faker.internet.url();
      const store = createDevSessionStore(document, overrideUrl);

      store.markReady(manifest.id, hostId);

      expect(store.devSession(hostId, publishedCatalog)?.overrideUrl).toBe(
        overrideUrl,
      );
    });

    it('should keep the app ready when the same registration is refreshed', () => {
      const store = createDevSessionStore(document, faker.internet.url());

      store.markReady(manifest.id, hostId);
      store.register(document);

      expect(store.devSession(hostId, publishedCatalog)?.overrides).toStrictEqual(
        document.overrides,
      );
    });

    it('should keep the offer id when the same registration is refreshed', () => {
      const store = createDevSessionStore(document, faker.internet.url());

      store.markReady(manifest.id, hostId);
      store.register(document);

      expect(store.devSession(hostId, publishedCatalog)?.offerIds).toStrictEqual(
        { [manifest.id]: generatedAt },
      );
    });
  });

  it('should offer a restarted app under its new registration time when it registers again', () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest();
    const restartDocument = anOverrideDocument({
      hostId,
      generatedAt: faker.date.recent().toISOString(),
      overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
    });
    const store = createDevSessionStore(
      anOverrideDocument({
        hostId,
        generatedAt: faker.date.past().toISOString(),
        overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
      }),
      faker.internet.url(),
    );

    store.unregister(manifest.id, hostId);
    store.register(restartDocument);
    store.markReady(manifest.id, hostId);

    expect(store.devSession(hostId)?.offerIds).toStrictEqual({
      [manifest.id]: restartDocument.generatedAt,
    });
  });

  it('should keep the offer of an app when another app registers', () => {
    const hostId = faker.string.uuid();
    const kept = anAppManifest();
    const other = anAppManifest();
    const keptDocument = anOverrideDocument({
      hostId,
      generatedAt: faker.date.past().toISOString(),
      overrides: [{ appId: kept.id, manifest: kept, reason: 'local' }],
    });
    const store = createDevSessionStore(keptDocument, faker.internet.url());

    store.register(
      anOverrideDocument({
        hostId,
        generatedAt: faker.date.recent().toISOString(),
        overrides: [{ appId: other.id, manifest: other, reason: 'local' }],
      }),
    );
    store.markReady(kept.id, hostId);

    expect(store.devSession(hostId)?.offerIds).toStrictEqual({
      [kept.id]: keptDocument.generatedAt,
    });
  });

  it('should not offer an app when it is not ready', () => {
    const hostId = faker.string.uuid();
    const ready = anAppManifest();
    const starting = anAppManifest();
    const store = createDevSessionStore(
      anOverrideDocument({
        hostId,
        overrides: [
          { appId: ready.id, manifest: ready, reason: 'local' },
          { appId: starting.id, manifest: starting, reason: 'local' },
        ],
      }),
      faker.internet.url(),
    );

    store.markReady(ready.id, hostId);

    expect(Object.keys(store.devSession(hostId)?.offerIds ?? {})).toStrictEqual(
      [ready.id],
    );
  });

  it('should offer the host override under its registration time when the host is ready', () => {
    const hostId = faker.string.uuid();
    const hostOverride = aHostManifest({ id: hostId });
    const generatedAt = faker.date.past().toISOString();
    const store = createDevSessionStore(
      { ...anOverrideDocument({ hostId, generatedAt }), hostOverride },
      faker.internet.url(),
    );

    store.markHostReady(hostId);

    expect(store.devSession(hostId)?.offerIds).toStrictEqual({
      [hostId]: generatedAt,
    });
  });

  it('should serve the local catalog when no published catalog exists', () => {
    const hostId = faker.string.uuid();
    const manifest = anAppManifest();
    const store = createDevSessionStore(
      anOverrideDocument({
        hostId,
        overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
      }),
      faker.internet.url(),
    );

    store.markReady(manifest.id, hostId);

    expect(store.devSession(hostId)?.catalog.apps).toStrictEqual([manifest]);
  });

  it('should serve no session when nothing is ready', () => {
    const manifest = anAppManifest();
    const document = anOverrideDocument({
      overrides: [{ appId: manifest.id, manifest, reason: 'local' }],
    });
    const store = createDevSessionStore(document, faker.internet.url());

    expect(store.devSession(document.hostId)).toBeUndefined();
  });
});
