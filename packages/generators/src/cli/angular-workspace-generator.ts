import { angularRemoteName } from './angular-names.js';
import type { AngularVersionProfile } from './generator-versions.js';
import type { AngularStylesheetFormat } from './generator-types.js';

export function angularWorkspace(
  name: string,
  host: boolean,
  devServerPort = defaultDevServerPort(host),
  stylesheetFormat: AngularStylesheetFormat = 'css',
  profile: AngularVersionProfile,
): unknown {
  const originalDevServerPort = host
    ? hostClientPort(devServerPort)
    : devServerPort;
  return {
    version: 1,
    projects: {
      [name]: {
        projectType: 'application',
        root: '',
        sourceRoot: 'src',
        architect: {
          build: {
            builder: angularNativeFederationBuilder(profile),
            options: { target: `${name}:esbuild:production` },
            configurations: {
              development: { target: `${name}:esbuild:development`, dev: true },
            },
          },
          serve: {
            builder: angularNativeFederationBuilder(profile),
            options: {
              target: `${name}:serve-original:development`,
              dev: true,
              port: devServerPort,
            },
          },
          esbuild: {
            builder: '@angular-devkit/build-angular:application',
            options: {
              outputPath: `dist/${name}`,
              index: 'src/index.html',
              browser: 'src/main.ts',
              preserveSymlinks: true,
              polyfills: [
                ...(!profile.zoneless ? ['zone.js'] : []),
                'es-module-shims',
              ],
              tsConfig: 'tsconfig.app.json',
              assets: [{ glob: '**/*', input: 'public' }],
              styles: [`src/styles.${stylesheetFormat}`],
            },
            configurations: {
              production: { outputHashing: 'all' },
              development: { optimization: false, sourceMap: true },
            },
          },
          'serve-original': {
            builder: '@angular-devkit/build-angular:dev-server',
            options: { port: originalDevServerPort },
            configurations: {
              production: { buildTarget: `${name}:esbuild:production` },
              development: { buildTarget: `${name}:esbuild:development` },
            },
            defaultConfiguration: 'development',
          },
        },
      },
    },
  };
}

function defaultDevServerPort(host: boolean): number {
  return host ? 4200 : 4201;
}

function hostClientPort(bootstrapPort: number): number {
  return bootstrapPort === 4300 ? 4200 : 4300;
}

function angularCompilerOptions(): Record<string, unknown> {
  return {
    target: 'ES2022',
    module: 'ES2022',
    moduleResolution: 'bundler',
    strict: true,
    experimentalDecorators: true,
    useDefineForClassFields: false,
    lib: ['ES2022', 'DOM'],
    skipLibCheck: true,
  };
}

function angularTemplateCompilerOptions(): Record<string, unknown> {
  return { strictTemplates: true, strictInjectionParameters: true };
}

export function angularAppTsconfig(): unknown {
  return {
    extends: './tsconfig.json',
    compilerOptions: { outDir: './out-tsc/app' },
    files: ['src/main.ts', 'atlas.config.ts'],
    include: ['src/**/*.ts', '.atlas/**/*.ts'],
  };
}

export function angularRootTsconfig(): unknown {
  return {
    compilerOptions: angularCompilerOptions(),
    angularCompilerOptions: angularTemplateCompilerOptions(),
  };
}

export function angularFederationConfig(
  name: string,
  host: boolean,
  profile: AngularVersionProfile,
): string {
  if (usesNativeFederationV4(profile)) {
    return `import { createAngularV4FederationConfig } from "@atlas/sdk/federation-config";

export default await createAngularV4FederationConfig({
  projectRoot: import.meta.dirname,
  name: "${angularRemoteName(name)}",
  expose: "${host ? 'host' : 'app'}",
  nativeFederationPackage: "${nativeFederationPackage(profile)}"
});
`;
  }
  return `const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "${angularRemoteName(name)}",
  expose: "${host ? 'host' : 'app'}"
});
`;
}

export function angularFederationConfigFile(profile: AngularVersionProfile): string {
  return usesNativeFederationV4(profile)
    ? 'federation.config.mjs'
    : 'federation.config.js';
}

function angularNativeFederationBuilder(profile: AngularVersionProfile): string {
  return `${nativeFederationPackage(profile)}:build`;
}

function nativeFederationPackage(profile: AngularVersionProfile): string {
  return profile.major === 20 || profile.major === 21
    ? '@angular-architects/native-federation-v4'
    : '@angular-architects/native-federation';
}

function usesNativeFederationV4(profile: AngularVersionProfile): boolean {
  return profile.major >= 20;
}
