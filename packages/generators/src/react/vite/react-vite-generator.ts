import { defaultDevServerPort } from '../../shared/ports/ports.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';

interface ReactViteConfigOptions {
  name: string;
  type: AtlasProjectType;
  reactMajor?: number;
  devServerPort?: number;
}

export function reactViteConfig(options: ReactViteConfigOptions): string {
  const { name, type, reactMajor } = options;
  const devServerPort = options.devServerPort ?? defaultDevServerPort(type);
  const factory =
    type === 'host' ? 'createReactHostViteConfig' : 'createReactAppViteConfig';
  const reactMajorField =
    type === 'app'
      ? `
    reactMajor: ${reactMajor},`
      : '';

  return `import { ${factory} } from "@atlas/sdk/federation-config";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(mergeConfig(
  ${factory}({
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
