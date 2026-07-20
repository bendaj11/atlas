export function reactHostViteConfig(
  name: string,
  compilerTarget: string,
  devServerPort = 4200,
): string {
  return reactViteConfig({ type: 'Host', name, compilerTarget, devServerPort });
}

export function reactAppViteConfig(
  name: string,
  compilerTarget: string,
  devServerPort = 4201,
): string {
  return reactViteConfig({ type: 'App', name, compilerTarget, devServerPort });
}

interface ReactViteConfigTemplateOptions {
  readonly type: 'App' | 'Host';
  readonly name: string;
  readonly compilerTarget: string;
  readonly devServerPort: number;
}

function reactViteConfig(options: ReactViteConfigTemplateOptions): string {
  const { type, name, compilerTarget, devServerPort } = options;
  return `import { createReact${type}ViteConfig } from "@atlas/sdk/federation-config";
import { defineConfig, mergeConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(mergeConfig(
  createReact${type}ViteConfig({ projectRoot: __dirname, projectName: "${name}"${type === 'App' ? `, reactMajor: ${compilerTarget}` : ''} }),
  {
    base: "./",
    plugins: [
      react({
        babel: {
          plugins: [["babel-plugin-react-compiler", { target: "${compilerTarget}", panicThreshold: "none" }]]
        }
      })
    ],
    server: { port: ${devServerPort}, cors: true }
  }
));
`;
}
