import type { AtlasHostManifest, AtlasManifest } from '@atlas/schema';
import { errorMessage } from '../../shared/index.js';
import { parseFederationMetadata } from '../federation-metadata/federation-metadata.js';
import {
  checkContentType,
  checkCors,
  checkImmutableCache,
  checkIntegrity,
} from '../header-checks/header-checks.js';
import type { AssetExpectation, VerificationContext } from '../types.js';
import type { VerifiedFetch } from '../verified-fetch/verified-fetch.js';

type VerifiedManifest = AtlasManifest | AtlasHostManifest;

export function verifyManifestAssets({
  manifest,
  context,
  fetch,
}: {
  manifest: VerifiedManifest;
  context: VerificationContext;
  fetch: VerifiedFetch;
}): Promise<void>[] {
  const assets: AssetExpectation[] = [
    {
      url: manifest.remoteEntryUrl,
      subject: `${manifest.id} remote entry`,
      integrity: manifest.integrity,
      contentType: 'json',
      inspectFederationReferences: true,
    },
    ...(manifest.styles ?? []).map((style, index): AssetExpectation => ({
      url: style.href,
      subject: `${manifest.id} stylesheet ${index + 1}`,
      integrity: style.integrity,
      contentType: 'css',
    })),
  ];

  return assets.map((asset) =>
    verifyAsset({ asset, manifest, context, fetch }),
  );
}

async function verifyAsset({
  asset,
  manifest,
  context,
  fetch,
}: {
  asset: AssetExpectation;
  manifest: VerifiedManifest;
  context: VerificationContext;
  fetch: VerifiedFetch;
}): Promise<void> {
  const url = new URL(asset.url, context.hostUrl);
  context.checks.pass(`${asset.subject} URL`, url.href);

  let bytes: Uint8Array | undefined;
  const response = await fetch.checked({
    url,
    subject: asset.subject,
    context,
    consume: async (loaded) => {
      bytes = new Uint8Array(await loaded.arrayBuffer());
    },
  });

  if (!response) return;

  checkCors({
    checks: context.checks,
    response,
    url,
    subject: asset.subject,
    hostOrigin: context.hostOrigin,
  });
  checkContentType({
    checks: context.checks,
    response,
    subject: asset.subject,
    expected: asset.contentType,
  });
  checkImmutableCache({
    checks: context.checks,
    response,
    subject: asset.subject,
    channel: manifest.channel,
  });

  if (!bytes) return;

  checkIntegrity({
    checks: context.checks,
    bytes,
    subject: asset.subject,
    integrity: asset.integrity,
    channel: manifest.channel,
  });

  if (asset.inspectFederationReferences)
    await verifyFederationReferences({
      bytes,
      remoteEntryUrl: url,
      manifest,
      context,
      fetch,
    });
}

async function verifyFederationReferences({
  bytes,
  remoteEntryUrl,
  manifest,
  context,
  fetch,
}: {
  bytes: Uint8Array;
  remoteEntryUrl: URL;
  manifest: VerifiedManifest;
  context: VerificationContext;
  fetch: VerifiedFetch;
}): Promise<void> {
  let metadata;

  try {
    metadata = parseFederationMetadata(bytes);
  } catch (error) {
    context.checks.fail(
      `${manifest.id} federation metadata`,
      errorMessage(error),
    );

    return;
  }

  verifyExposes({ metadata, manifest, context });

  const references = [
    ...metadata.exposes.map((entry) => ({
      subject: `${manifest.id} expose ${entry.key}`,
      outFileName: entry.outFileName,
    })),
    ...metadata.shared.map((entry) => ({
      subject: `${manifest.id} shared ${entry.packageName}`,
      outFileName: entry.outFileName,
    })),
  ];

  await Promise.all(
    references.map(async ({ subject, outFileName }) => {
      const url = new URL(outFileName, remoteEntryUrl);
      const response = await fetch.checked({ url, subject, context });

      if (!response) return;

      checkCors({
        checks: context.checks,
        response,
        url,
        subject,
        hostOrigin: context.hostOrigin,
      });
      checkContentType({
        checks: context.checks,
        response,
        subject,
        expected: 'javascript',
      });
      checkImmutableCache({
        checks: context.checks,
        response,
        subject,
        channel: manifest.channel,
      });
    }),
  );
}

function verifyExposes({
  metadata,
  manifest,
  context,
}: {
  metadata: ReturnType<typeof parseFederationMetadata>;
  manifest: VerifiedManifest;
  context: VerificationContext;
}): void {
  const exposedKeys = new Set(metadata.exposes.map((entry) => entry.key));
  const requiredExposes = new Set([
    ...Object.values(manifest.exposes),
    ...(manifest.kind === 'app'
      ? (manifest.exportedWidgets ?? []).map((component) => component.expose)
      : []),
  ]);
  const missingExposes = [...requiredExposes].filter(
    (expose) => !exposedKeys.has(expose),
  );

  if (missingExposes.length > 0)
    context.checks.fail(
      `${manifest.id} federation exposes`,
      `Missing: ${missingExposes.join(', ')}.`,
    );
  else
    context.checks.pass(
      `${manifest.id} federation exposes`,
      'Manifest exposes are present in remote metadata.',
    );
}
