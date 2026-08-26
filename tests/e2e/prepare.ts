import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { delimiter, dirname, join, resolve } from 'node:path';
import type {
  AtlasManifestDescriptor,
  AtlasStaticRegistry,
} from '../../packages/schema/src/index.js';
import { registryRevision } from '../../packages/cli/src/publication/static-registry/static-registry.js';

const root = resolve(import.meta.dirname, '../..');
const artifacts = resolve(
  root,
  process.env.ATLAS_E2E_ARTIFACTS_DIR ?? 'tests/e2e/.artifacts',
);
const cdn = join(artifacts, 'cdn');
const externalCdn = join(artifacts, 'external-cdn');
const registryConfig = join(root, 'tests/e2e/atlas.registry.ts');
const cdnOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_CDN_PORT ?? '4400'}`;
const reactHostOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_REACT_HOST_PORT ?? '4300'}`;
const angularHostOrigin = `http://127.0.0.1:${process.env.ATLAS_E2E_ANGULAR_HOST_PORT ?? '4301'}`;
const REACT_HOST_ID = '060a7f62-1c95-402c-9993-55749faf36d9';
const ANGULAR_HOST_ID = '399e1a5d-f83d-4248-96ed-e4211707ae1b';
const ORDERS_ANGULAR_ID = 'f856e01e-0fc1-4a6d-a4ec-622c68100d14';
const CATALOG_REACT_ID = '3ae54928-c2c6-491d-b766-6996ce0ef3c8';
const DASHBOARD_ANGULAR_ID = '9a703156-6c63-47bb-aa10-d3d3a1b2a38b';
const DASHBOARD_REACT_ID = '56e41bf1-d1b4-486f-a340-5782ee632bad';
const EXTERNAL_SHARED_UI_ID = '745518fc-3b1a-4197-b044-da306b0a02ff';
const projects = [
  'demo-react-host',
  'demo-angular-host',
  'orders-angular',
  'catalog-react',
  'dashboard-angular',
  'dashboard-react',
];
const angularFederationCaches = [
  'examples/hosts/demo-angular-host/node_modules/.cache/native-federation',
  'examples/apps/orders-angular/node_modules/.cache/native-federation',
  'examples/apps/dashboard-angular/node_modules/.cache/native-federation',
];

await rm(artifacts, { recursive: true, force: true });
await Promise.all(
  angularFederationCaches.map((path) =>
    rm(join(root, path), { recursive: true, force: true }),
  ),
);
await mkdir(cdn, { recursive: true });
await mkdir(externalCdn, { recursive: true });
await run('pnpm', ['run', 'build']);
if (process.env.ATLAS_E2E_REUSE_BUILD_OUTPUT !== '1')
  await run('pnpm', ['run', 'build:examples']);

for (const project of projects) {
  await run(
    'node',
    [
      'packages/cli/dist/cli/entrypoint.js',
      'publish',
      project,
      '--version=0.1.0',
      `--registry-url=${cdnOrigin}`,
      `--registry-config=${registryConfig}`,
    ],
    publicationEnvironment({ ATLAS_CREATED_AT: '2026-01-01T00:00:00.000Z' }),
  );
}

await deploy(REACT_HOST_ID, '0.1.0');
await deploy(ANGULAR_HOST_ID, '0.1.0');
for (const appId of [
  ORDERS_ANGULAR_ID,
  CATALOG_REACT_ID,
  DASHBOARD_ANGULAR_ID,
  DASHBOARD_REACT_ID,
]) {
  await deploy(appId, '0.1.0');
}

await addSecondCatalogRelease();
await deploy(CATALOG_REACT_ID, '0.2.0');
await createExternalWidgetRegistry();
await addVersionFixtures(DASHBOARD_REACT_ID);
await buildBootstrap(
  'demo-react-host',
  join(artifacts, 'react-bootstrap'),
  REACT_HOST_ID,
);
await buildBootstrap(
  'demo-angular-host',
  join(artifacts, 'angular-bootstrap'),
  ANGULAR_HOST_ID,
);

async function buildBootstrap(project, output, hostId) {
  await run('node', [
    'packages/cli/dist/cli/entrypoint.js',
    'bootstrap',
    project,
    '--skip-compile',
    `--registry-url=${cdnOrigin}`,
    `--asset-origins=${cdnOrigin}`,
    `--out=${output}`,
  ]);
  await writeJson(join(output, 'atlas.runtime.json'), {
    schemaVersion: 'v1',
    hostId,
    environment: 'production',
    artifactRegistryUrl: cdnOrigin,
  });
}

async function deploy(project: string, version: string) {
  await run(
    'node',
    [
      'packages/cli/dist/cli/entrypoint.js',
      'deploy',
      project,
      '--to=production',
      `--version=${version}`,
      `--registry-url=${cdnOrigin}`,
      `--registry-config=${registryConfig}`,
    ],
    publicationEnvironment(),
  );
}

async function addSecondCatalogRelease() {
  const entryPath = join(root, 'examples/apps/catalog-react/dist/entry.js');
  const originalEntry = await readFile(entryPath, 'utf8');
  const releaseEntry = originalEntry.replace(
    'Catalog React',
    'Catalog React 0.2.0',
  );
  if (releaseEntry === originalEntry)
    throw new Error('Could not mark the second catalog-react release.');
  try {
    await writeFile(entryPath, releaseEntry, 'utf8');
    await run(
      'node',
      [
        'packages/cli/dist/cli/entrypoint.js',
        'publish',
        'catalog-react',
        '--skip-compile',
        '--version=0.2.0',
        `--registry-url=${cdnOrigin}`,
        `--registry-config=${registryConfig}`,
      ],
      publicationEnvironment({
        ATLAS_CREATED_AT: '2026-01-02T00:00:00.000Z',
        CI_COMMIT_TAG: 'v0.2.0',
      }),
    );
  } finally {
    await writeFile(entryPath, originalEntry, 'utf8');
  }
}

async function createExternalWidgetRegistry() {
  const sourceRegistry = JSON.parse(
    await readFile(join(cdn, 'registry.json'), 'utf8'),
  );
  const sourceArtifact = sourceRegistry.apps[CATALOG_REACT_ID];
  const releases: Record<string, AtlasManifestDescriptor> = {};
  for (const [version, sourceDescriptor] of Object.entries(
    sourceArtifact.releases,
  ) as Array<[string, { path: string }]>) {
    const sourceDirectory = dirname(join(cdn, sourceDescriptor.path));
    const targetDirectory = join(
      externalCdn,
      'apps',
      EXTERNAL_SHARED_UI_ID,
      version,
    );
    await cp(sourceDirectory, targetDirectory, { recursive: true });
    const targetManifestPath = join(targetDirectory, 'manifest.json');
    const sourceManifest = JSON.parse(
      await readFile(targetManifestPath, 'utf8'),
    );
    const targetManifest = {
      ...sourceManifest,
      id: EXTERNAL_SHARED_UI_ID,
      name: 'External Shared UI',
      placements: [],
      supportedHosts: ['*'],
      externalAppsDependencies: undefined,
      exportedWidgets: (sourceManifest.exportedWidgets ?? []).map((widget) => ({
        ...widget,
        id: '55ca3323-c62f-44de-9194-6ab42375e578',
        ownerAppId: EXTERNAL_SHARED_UI_ID,
      })),
    };
    const bytes = new TextEncoder().encode(
      `${JSON.stringify(targetManifest)}\n`,
    );
    await writeFile(targetManifestPath, bytes);
    releases[version] = {
      path: `apps/${EXTERNAL_SHARED_UI_ID}/${version}/manifest.json`,
      digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      size: bytes.byteLength,
      mediaType: 'application/json',
    };
  }
  if (!releases['0.1.0'])
    throw new Error('External widget fixture requires catalog-react 0.1.0.');
  const registry: AtlasStaticRegistry = {
    schemaVersion: '2',
    revision: `sha256:${'0'.repeat(64)}`,
    updatedAt: '2026-01-02T00:00:00.000Z',
    hosts: {},
    apps: {
      [EXTERNAL_SHARED_UI_ID]: {
        id: EXTERNAL_SHARED_UI_ID,
        name: 'External Shared UI',
        releases,
        previews: {},
        latest: '0.2.0',
      },
    },
  };
  registry.revision = registryRevision(registry) as `sha256:${string}`;
  await writeJson(join(externalCdn, 'registry.json'), registry);
}

async function addVersionFixtures(appId) {
  const entryPath = join(root, 'examples/apps/dashboard-react/dist/entry.js');
  const originalEntry = await readFile(entryPath, 'utf8');
  const historicalEntry = originalEntry.replace(
    'Dashboard React',
    'Dashboard React Historical',
  );
  if (historicalEntry === originalEntry)
    throw new Error('Could not mark dashboard historical release.');
  try {
    await writeFile(entryPath, historicalEntry, 'utf8');
    await run(
      'node',
      [
        'packages/cli/dist/cli/entrypoint.js',
        'publish',
        'dashboard-react',
        '--skip-compile',
        '--version=0.0.9',
        `--registry-url=${cdnOrigin}`,
        `--registry-config=${registryConfig}`,
      ],
      publicationEnvironment(),
    );
  } finally {
    await writeFile(entryPath, originalEntry, 'utf8');
  }
  await run(
    'node',
    [
      'packages/cli/dist/cli/entrypoint.js',
      'publish',
      'dashboard-react',
      '--skip-compile',
      '--pr=42',
      '--git-sha=abc123',
      `--registry-url=${cdnOrigin}`,
      `--registry-config=${registryConfig}`,
    ],
    publicationEnvironment(),
  );
  const registry = JSON.parse(
    await readFile(join(cdn, 'registry.json'), 'utf8'),
  );
  const descriptor = registry.apps[appId].releases['0.1.0'];
  const sourceDirectory = dirname(join(cdn, descriptor.path));
  await createDistinctArtifact(
    sourceDirectory,
    appId,
    '0.2.0-local',
    'local-dev',
    'Dashboard React Local',
  );
}

async function createDistinctArtifact(
  sourceDirectory,
  appId,
  version,
  buildId,
  heading,
) {
  const targetDirectory = join(cdn, 'apps', appId, version, buildId);
  await cp(sourceDirectory, targetDirectory, { recursive: true });
  const entryPath = join(targetDirectory, 'entry.js');
  const entry = await readFile(entryPath, 'utf8');
  const markedEntry = entry.replace('Dashboard React', heading);
  if (markedEntry === entry)
    throw new Error(`Could not mark the ${version} ${appId} artifact.`);
  await writeFile(entryPath, markedEntry, 'utf8');
  return targetDirectory;
}

async function run(command, args, environment = {}) {
  await new Promise<void>((resolvePromise, reject) => {
    const binPath = join(root, 'node_modules/.bin');
    const path = [binPath, process.env.PATH].filter(Boolean).join(delimiter);
    const env = {
      ...process.env,
      NG_BUILD_MAX_WORKERS: '1',
      PATH: path,
      ...environment,
    };
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolvePromise()
        : reject(
            new Error(`${command} ${args.join(' ')} exited with code ${code}.`),
          ),
    );
  });
}

function publicationEnvironment(environment = {}) {
  return { ATLAS_E2E_STORAGE: cdn, ...environment };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
