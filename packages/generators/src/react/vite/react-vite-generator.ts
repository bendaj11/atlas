import { getDefaultDevServerPort } from '../../shared/ports/ports.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';

interface ReactViteConfigOptions {
  name: string;
  type: AtlasProjectType;
  reactMajor?: number;
  devServerPort?: number;
}

export function renderReactViteConfig(options: ReactViteConfigOptions): string {
  const { name, type, reactMajor } = options;
  const devServerPort = options.devServerPort ?? getDefaultDevServerPort(type);
  const factoryName =
    type === 'host' ? 'createReactHostViteConfig' : 'createReactAppViteConfig';
  const reactMajorField =
    type === 'app'
      ? `
    reactMajor: ${reactMajor},`
      : '';

  return `import { ${factoryName} } from "@atlas/sdk/federation-config";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(mergeConfig(
  ${factoryName}({
    projectRoot: __dirname,
    projectName: "${name}",${reactMajorField}
    // Add app-local workspace packages here so Vite bundles and serves them locally.
    skip: []
  }),
  {
    base: "./",
    plugins: [react({})],
    server: { port: ${devServerPort}, cors: true }
  }
));
`;
}
