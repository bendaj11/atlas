import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SupportedFramework, AtlasPrompter } from '../../shared/index.js';
import type { AtlasProject, AtlasWorkspace } from '../../workspace/index.js';

export interface WidgetAppSelection {
  id: string;
  name: string;
  framework: SupportedFramework;
  project: AtlasProject;
}

export async function resolveWidgetApp(options: {
  workspace: AtlasWorkspace;
  prompts: Pick<AtlasPrompter, 'interactive' | 'select'>;
  requestedAppId?: string;
}): Promise<WidgetAppSelection> {
  const { workspace, prompts, requestedAppId } = options;
  const apps = await listConfiguredWidgetApps(workspace);

  if (apps.length === 0)
    throw new Error(
      `Atlas found no configured apps in workspace ${workspace.root}.`,
    );

  if (requestedAppId) {
    const requestedApp = apps.find(({ id }) => id === requestedAppId);

    if (requestedApp) return requestedApp;
    throw new Error(
      `Could not find Atlas app ID "${requestedAppId}". ${formatAvailableAppsMessage(apps)}`,
    );
  }

  if (!prompts.interactive) {
    throw new Error(
      `--app-id <app-id> is required to generate a widget in non-interactive mode. ${formatAvailableAppsMessage(apps)}`,
    );
  }
  const selectedAppId = await prompts.select(
    'Which Atlas app should own this widget?',
    apps.map((app) => ({ label: `${app.name} (${app.id})`, value: app.id })),
  );

  return apps.find(({ id }) => id === selectedAppId)!;
}

async function listConfiguredWidgetApps(
  workspace: AtlasWorkspace,
): Promise<WidgetAppSelection[]> {
  const projects = await workspace.listProjects();
  const apps = await Promise.all(projects.map(readWidgetApp));

  return apps
    .filter((app): app is WidgetAppSelection => app !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function readWidgetApp(
  project: AtlasProject,
): Promise<WidgetAppSelection | undefined> {
  const configPath = join(project.root, 'atlas.config.ts');
  const source = await readFile(configPath, 'utf8');

  if (extractLiteralConfigFieldValue(source, 'type') === 'host')
    return undefined;
  const id = extractLiteralConfigFieldValue(source, 'id');

  if (!id)
    throw new Error(
      `Could not determine the stable Atlas app ID from ${configPath}.`,
    );

  const framework = extractLiteralConfigFieldValue(source, 'framework');

  if (framework !== 'angular' && framework !== 'react') {
    throw new Error(
      `Could not determine a supported app framework from ${configPath}.`,
    );
  }

  return {
    id,
    name: extractLiteralConfigFieldValue(source, 'name') ?? id,
    framework,
    project,
  };
}

function extractLiteralConfigFieldValue(
  source: string,
  field: 'type' | 'id' | 'name' | 'framework',
): string | undefined {
  return source.match(
    new RegExp(`(?:["']${field}["']|\\b${field})\\s*:\\s*["']([^"']+)["']`),
  )?.[1];
}

function formatAvailableAppsMessage(
  apps: readonly WidgetAppSelection[],
): string {
  return `Available apps: ${apps.map(({ id, name }) => `${name} (${id})`).join(', ')}.`;
}
