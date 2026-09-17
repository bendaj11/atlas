import type {
  AtlasHostCatalog,
  AtlasHostRuntimeConfig,
  AtlasManifest,
} from '@atlas/schema';
import { validateHostManifest } from '../validate-host-manifest/validate-host-manifest.js';
import { CatalogInvalidError } from '../../../shared/errors/index.js';
import { describeManifest } from '../describe-manifest.js';

export function validateCatalog({
  runtime,
  catalog,
}: {
  runtime: AtlasHostRuntimeConfig;
  catalog: AtlasHostCatalog;
}): void {
  if (catalog.schemaVersion !== '1') {
    throw new CatalogInvalidError(
      `Atlas catalog schemaVersion must be "1", got ${JSON.stringify(catalog.schemaVersion)}.`,
    );
  }

  if (catalog.hostId !== runtime.hostId) {
    throw new CatalogInvalidError(
      `Atlas catalog belongs to host "${catalog.hostId}" but runtime selects host "${runtime.hostId}".`,
    );
  }

  if (catalog.host.kind !== 'host' || catalog.host.id !== runtime.hostId) {
    throw new CatalogInvalidError(
      `Atlas catalog host entry must be a host manifest with id "${runtime.hostId}", got ${describeManifest(catalog.host)}.`,
    );
  }

  assertAppManifests({ manifests: catalog.apps, subject: 'apps' });

  if (catalog.widgetProviders) {
    assertAppManifests({
      manifests: catalog.widgetProviders,
      subject: 'widget providers',
    });
  }

  validateHostManifest({ manifest: catalog.host, runtime });
}

function assertAppManifests({
  manifests,
  subject,
}: {
  manifests: AtlasManifest[];
  subject: string;
}): void {
  if (!Array.isArray(manifests)) {
    throw new CatalogInvalidError(`Atlas catalog ${subject} must be an array.`);
  }

  const stray = manifests.find((manifest) => manifest.kind !== 'app');

  if (stray) {
    throw new CatalogInvalidError(
      `Atlas catalog ${subject} must contain app manifests only, got ${describeManifest(stray)}.`,
    );
  }
}
