import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { AtlasHostConfig, AtlasHostManifest } from '@atlas/schema';
import { trimTrailingSlash, writeJsonFile } from '../../shared/index.js';
import type { AtlasProject } from '../../workspace/index.js';
import { discoverStylesheets } from '../stylesheets/stylesheets.js';
import { buildTimestamp } from '../timestamp/timestamp.js';

export const DEFAULT_ENTRY_PATH = 'remoteEntry.json';

export async function writeLocalHostManifest({
  project,
  config,
  baseUrl,
}: {
  project: AtlasProject;
  config: AtlasHostConfig;
  baseUrl: string;
}): Promise<AtlasHostManifest> {
  const origin = trimTrailingSlash(baseUrl);
  const styles = await discoverStylesheets({
    artifactRoot: project.root,
    artifactBaseUrl: origin,
    framework: config.framework,
    channel: 'local',
  });
  const manifest: AtlasHostManifest = {
    schemaVersion: '1',
    kind: 'host',
    id: config.id,
    name: config.name ?? config.id,
    version: project.version,
    buildId: 'local',
    channel: 'local',
    framework: config.framework,
    remoteEntryUrl: `${origin}/${DEFAULT_ENTRY_PATH}`,
    exposes: { entry: './host' },
    requiredLoaderApiVersion: '^1.0.0',
    createdAt: buildTimestamp(),
    ...(styles.length ? { styles } : {}),
  };

  await mkdir(join(project.root, '.atlas'), { recursive: true });
  await writeJsonFile(
    join(project.root, '.atlas', 'local-host.manifest.json'),
    manifest,
  );

  return manifest;
}
