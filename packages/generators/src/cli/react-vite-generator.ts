export function reactHostViteConfig(
  name: string,
  devServerPort = 4200,
): string {
  return reactViteConfig({ type: 'Host', name, devServerPort });
}

export function reactAppViteConfig(
  name: string,
  reactMajor: number,
  devServerPort = 4201,
): string {
  return reactViteConfig({ type: 'App', name, reactMajor, devServerPort });
}

interface ReactViteConfigTemplateOptions {
  readonly type: 'App' | 'Host';
  readonly name: string;
  readonly reactMajor?: number;
  readonly devServerPort: number;
}

function reactViteConfig(options: ReactViteConfigTemplateOptions): string {
  const { type, name, reactMajor, devServerPort } = options;
  return `import { createReact${type}ViteConfig } from "@atlas/sdk/federation-config";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(mergeConfig(
  createReact${type}ViteConfig({ projectRoot: __dirname, projectName: "${name}"${type === 'App' ? `, reactMajor: ${reactMajor}` : ''} }),
  {
    base: "./",
    plugins: [react({})],
    server: { port: ${devServerPort}, cors: true }
  }
));
`;
}
