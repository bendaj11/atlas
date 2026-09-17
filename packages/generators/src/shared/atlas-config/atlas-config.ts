import { randomUUID } from 'node:crypto';
import { createBootstrapHtml } from '@atlas/bootstrap';
import { convertIdToTitle } from '../text/text.js';
import type { AtlasGeneratorOptions } from '../types/generator-types.js';

export function renderAtlasAppConfig(options: AtlasGeneratorOptions): string {
  const { name, framework, hostId } = options;
  const routesField = hostId
    ? `,\n  ${renderAtlasAppRoutes({ name, hostId })}`
    : '';

  return `import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "app",\n  id: "${randomUUID()}",\n  name: "${convertIdToTitle(name)}",\n  framework: "${framework}"${routesField}\n} satisfies AtlasAppConfig;\n`;
}

export function renderAtlasHostConfig(options: {
  generatorOptions: AtlasGeneratorOptions;
  hostId: string;
}): string {
  const { name, framework } = options.generatorOptions;

  return `import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "host",\n  id: "${options.hostId}",\n  name: "${convertIdToTitle(name)}",\n  framework: "${framework}"\n} satisfies AtlasHostConfig;\n`;
}

export function renderAtlasBootstrapHtml(name: string): string {
  return `${createBootstrapHtml({ title: convertIdToTitle(name) })}\n`;
}

function renderAtlasAppRoutes(options: {
  name: string;
  hostId: string;
}): string {
  const { name, hostId } = options;
  const title = convertIdToTitle(name);

  return `routes: [{ hostId: "${hostId}", path: "/${name}", title: "${title}", nav: { label: "${title}", visible: true } }]`;
}
