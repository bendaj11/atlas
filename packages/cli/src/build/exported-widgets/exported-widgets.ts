import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  AtlasConfig,
  AtlasExportedWidgetManifest,
  AtlasWidgetConfig,
} from '@atlas/schema';
import ts from 'typescript';
import { pathExists, isMissingPathError } from '../../shared/index.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function discoverExportedWidgets(options: {
  projectRoot: string;
  config: AtlasConfig;
  ownerRemoteEntryUrl: string;
}): Promise<AtlasExportedWidgetManifest[]> {
  const { projectRoot, config, ownerRemoteEntryUrl } = options;
  const directory = join(projectRoot, 'src', 'exported-widgets');
  const entries = await readdir(directory, { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissingPathError(error)) return [];
      throw error;
    },
  );
  const widgets: AtlasExportedWidgetManifest[] = [];

  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (!entry.isDirectory()) continue;
    const widgetConfig = await readWidget({
      directory: join(directory, entry.name),
      name: entry.name,
      config,
    });
    widgets.push({
      schemaVersion: '1',
      id: widgetConfig.id,
      name: widgetConfig.name,
      ownerAppId: config.id,
      framework: config.framework,
      remoteEntryUrl: ownerRemoteEntryUrl,
      expose: `./widgets/${entry.name}`,
      contractVersion: '1',
    });
  }

  return widgets;
}

async function readWidget(options: {
  directory: string;
  name: string;
  config: AtlasConfig;
}): Promise<AtlasWidgetConfig> {
  const { directory, name, config } = options;
  const extension = config.framework === 'react' ? 'tsx' : 'ts';
  if (!(await pathExists(join(directory, `index.${extension}`)))) {
    throw new Error(
      `Exported widget "${name}" must contain src/exported-widgets/${name}/index.${extension}.`,
    );
  }

  try {
    return await loadWidgetConfig(join(directory, 'atlas.config.ts'));
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(
        `Exported widget "${name}" must contain src/exported-widgets/${name}/atlas.config.ts. Run atlas g widget ${name} --app-id=${config.id} or add a stable UUIDv4 id and name.`,
      );
    }

    throw error;
  }
}

async function loadWidgetConfig(path: string): Promise<AtlasWidgetConfig> {
  const source = await readFile(path, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  const loaded = (await import(moduleUrl)) as { default?: unknown };
  if (!isWidgetConfig(loaded.default)) {
    throw new Error(
      `Widget config ${path} must export { id: UUIDv4, name: string } as default.`,
    );
  }

  return loaded.default;
}

function isWidgetConfig(value: unknown): value is AtlasWidgetConfig {
  if (typeof value !== 'object' || value === null) return false;
  const config = value as Partial<AtlasWidgetConfig>;

  return (
    typeof config.name === 'string' &&
    config.name.trim().length > 0 &&
    typeof config.id === 'string' &&
    UUID_V4.test(config.id)
  );
}
