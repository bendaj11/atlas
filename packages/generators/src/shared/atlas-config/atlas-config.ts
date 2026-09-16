import { randomUUID } from 'node:crypto';
import { createBootstrapHtml } from '@atlas/bootstrap';
import { title } from '../text/text.js';
import type { AtlasGeneratorOptions } from '../types/generator-types.js';

export function atlasAppConfig(options: AtlasGeneratorOptions): string {
  const { name, framework } = options;
  const appFields = options.hostId
    ? `,\n  ${appRoutes(name, options.hostId)}`
    : '';

  return `import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "app",\n  id: "${randomUUID()}",\n  name: "${title(name)}",\n  framework: "${framework}"${appFields}\n} satisfies AtlasAppConfig;\n`;
}

export function atlasHostConfig(
  options: AtlasGeneratorOptions,
  hostId: string,
): string {
  const { name, framework } = options;

  return `import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "host",\n  id: "${hostId}",\n  name: "${title(name)}",\n  framework: "${framework}"\n} satisfies AtlasHostConfig;\n`;
}

export function atlasBootstrapHtml(name: string): string {
  return `${createBootstrapHtml({ title: title(name) })}\n`;
}

function appRoutes(name: string, hostId: string): string {
  return `routes: [{ hostId: "${hostId}", path: "/${name}", title: "${title(name)}", nav: { label: "${title(name)}", visible: true } }]`;
}
