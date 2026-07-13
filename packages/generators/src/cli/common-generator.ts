import { randomUUID } from "node:crypto";
import type { AtlasGeneratorOptions } from "./generator-types.js";
import { ATLAS_PACKAGE_VERSION } from "./generator-versions.js";

const MAX_ATLAS_ID_LENGTH = 214;
const ATLAS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertValidGeneratorOptions(options: AtlasGeneratorOptions): void {
  assertValidAtlasId(options.name, "name");
  if (options.hostId !== undefined) assertValidAtlasId(options.hostId, "hostId");
}

export function atlasAppConfig(options: AtlasGeneratorOptions): string {
  const { name, framework } = options;
  const appFields = options.hostId ? `,\n  ${appConfig(name, options.hostId)}` : "";
  return `import type { AtlasAppConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "app",\n  id: "${randomUUID()}",\n  name: "${title(name)}",\n  framework: "${framework}"${appFields}\n} satisfies AtlasAppConfig;\n`;
}

export function atlasHostConfig(options: AtlasGeneratorOptions): string {
  const { name, framework } = options;
  return `import type { AtlasHostConfig } from "@atlas/schema" with { "resolution-mode": "import" };\n\nexport default {\n  type: "host",\n  id: "${randomUUID()}",\n  name: "${title(name)}",\n  framework: "${framework}"\n} satisfies AtlasHostConfig;\n`;
}

export function atlasHostContainerfile(): string {
  return `FROM node:22-alpine

RUN npm install --global @atlas/host-server@${ATLAS_PACKAGE_VERSION}

USER node
EXPOSE 8080
CMD ["atlas-host-server"]
`;
}

export function assertSupportedGeneratorFramework(options: AtlasGeneratorOptions): asserts options is AtlasGeneratorOptions & { framework: "angular" | "react" } {
  if (options.framework !== "angular" && options.framework !== "react") {
    throw new Error(`Unsupported Atlas generator framework: ${options.framework}. Use angular or react.`);
  }
}

function assertValidAtlasId(value: string, field: "name" | "hostId"): void {
  if (value.length > MAX_ATLAS_ID_LENGTH || !ATLAS_ID_PATTERN.test(value)) {
    throw new Error(`Invalid generator ${field} "${value}". Use 1-${MAX_ATLAS_ID_LENGTH} lowercase letters, numbers, and single hyphens between words.`);
  }
}

export function title(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function atlasHostStyles(): string {
  return `body {
  margin: 0;
  font-family: system-ui, sans-serif;
}

[data-atlas-navigation] {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

[data-atlas-route-outlet] {
  padding: 1rem;
}

[data-atlas-status] {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid #b8bec7;
}

[data-atlas-spinner] {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid #b8bec7;
  border-top-color: #2463eb;
  border-radius: 50%;
  animation: atlas-spin 0.7s linear infinite;
}

@keyframes atlas-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-atlas-spinner] {
    animation-duration: 1.5s;
  }
}
`;
}

function appConfig(name: string, hostId: string): string {
  return `routes: [{ hostId: "${hostId}", basePath: "/${name}", title: "${title(name)}", nav: { label: "${title(name)}", visible: true } }]`;
}
