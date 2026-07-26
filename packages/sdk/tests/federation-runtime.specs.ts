import {
  processHostInfo,
  processRemoteInfos,
} from '@softarc/native-federation-runtime';
import { afterEach, expect, jest, test } from '@jest/globals';

afterEach(() => {
  jest.restoreAllMocks();
});

test('Native Federation reuses host shared URL for exact package version', async () => {
  const packageName = '@atlas-test/exact-share';
  await processHostInfo(
    federationInfo(packageName, '2.4.1', 'host-package.js'),
    'https://host.example/artifacts/',
  );
  mockRemoteMetadata(
    federationInfo(packageName, '2.4.1', 'remote-package.js'),
  );

  const importMap = await processRemoteInfos(
    { remote: 'https://remote.example/artifacts/remoteEntry.json' },
    { throwIfRemoteNotFound: true },
  );

  expect(
    importMap.scopes?.['https://remote.example/artifacts/']?.[packageName],
  ).toBe('https://host.example/artifacts/host-package.js');
});

test('Native Federation keeps incompatible package version remote-scoped', async () => {
  const packageName = '@atlas-test/version-isolation';
  await processHostInfo(
    federationInfo(packageName, '2.4.1', 'host-package.js'),
    'https://host.example/artifacts/',
  );
  mockRemoteMetadata(
    federationInfo(packageName, '3.0.0', 'remote-package.js'),
  );

  const importMap = await processRemoteInfos(
    { remote: 'https://remote.example/artifacts/remoteEntry.json' },
    { throwIfRemoteNotFound: true },
  );

  expect(
    importMap.scopes?.['https://remote.example/artifacts/']?.[packageName],
  ).toBe('https://remote.example/artifacts/remote-package.js');
});

function federationInfo(
  packageName: string,
  version: string,
  outFileName: string,
) {
  return {
    name: 'atlas_test',
    exposes: [],
    shared: [
      {
        packageName,
        outFileName,
        requiredVersion: `^${version}`,
        singleton: true,
        strictVersion: true,
        version,
      },
    ],
  };
}

function mockRemoteMetadata(metadata: ReturnType<typeof federationInfo>): void {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(metadata), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
}
