import type { AtlasGeneratorOptions } from "./generator-types.js";

const MAX_ATLAS_ID_LENGTH = 214;
const ATLAS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertValidGeneratorOptions(options: AtlasGeneratorOptions): void {
  assertValidAtlasId(options.name, "name");
  if (options.hostId !== undefined) assertValidAtlasId(options.hostId, "hostId");
}

export function atlasConfig(options: AtlasGeneratorOptions, host: boolean): string {
  const { name, framework } = options;
  const microfrontendFields = options.hostId ? `,\n  ${microfrontendConfig(name, options.hostId)}` : "";
  return `import type { AtlasConfig } from "@atlas/contracts" with { "resolution-mode": "import" };\n\nexport default {\n  id: "${name}",\n  name: "${title(name)}",\n  framework: "${framework}"${host ? "" : microfrontendFields}\n} satisfies AtlasConfig;\n`;
}

export function atlasHostConfig(options: AtlasGeneratorOptions): string {
  const { name, framework } = options;
  return `import type { AtlasConfig } from "@atlas/contracts" with { "resolution-mode": "import" };\n\nexport default {\n  id: "${name}",\n  name: "${title(name)}",\n  framework: "${framework}",\n  runtime: {\n    catalogUrl: "http://localhost:4400/hosts/${name}/catalog.json",\n    requireIntegrity: true,\n    allowRuntimeOverrides: true,\n    requestTimeoutMs: 10000,\n    retryAttempts: 2,\n    retryDelayMs: 250,\n    loadTimeoutMs: 15000,\n    waitForMfReady: true,\n    loadingIndicator: "spinner"\n  }\n} satisfies AtlasConfig;\n`;
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
  return `body { margin: 0; font-family: system-ui, sans-serif; }\n[data-atlas-navigation] { display: flex; gap: 1rem; padding: 1rem; }\n[data-atlas-route-outlet] { padding: 1rem; }\n[data-atlas-status] { display: flex; align-items: center; gap: .75rem; padding: 1rem; border: 1px solid #b8bec7; }\n[data-atlas-spinner] { width: 1.25rem; height: 1.25rem; border: 2px solid #b8bec7; border-top-color: #2463eb; border-radius: 50%; animation: atlas-spin .7s linear infinite; }\n@keyframes atlas-spin { to { transform: rotate(360deg); } }\n@media (prefers-reduced-motion: reduce) { [data-atlas-spinner] { animation-duration: 1.5s; } }\n`;
}

function microfrontendConfig(name: string, hostId: string): string {
  return `hostCompatibility: ["${hostId}"],\n  placements: [{ id: "${name}-route", kind: "route", hostId: "${hostId}", route: { id: "${name}", basePath: "/${name}", title: "${title(name)}", nav: { label: "${title(name)}", visible: true } } }]`;
}
