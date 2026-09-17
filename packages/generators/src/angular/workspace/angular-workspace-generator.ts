import {
  selectNativeFederationBuilder,
  selectNativeFederationPackage,
  usesNativeFederationV4ConfigApi,
} from '../federation/angular-federation.js';
import { convertNameToFederationRemoteName } from '../names/angular-names.js';
import {
  deriveHostClientPortFromBootstrapPort,
  getDefaultDevServerPort,
} from '../../shared/ports/ports.js';
import type {
  AngularWorkspaceDocument,
  TsconfigDocument,
} from '../../shared/types/generated-documents.js';
import type {
  AngularStylesheetFormat,
  AtlasProjectType,
} from '../../shared/types/generator-types.js';
import type { AngularVersionProfile } from '../../shared/versions/generator-versions.types.js';

const ANGULAR_BUILD_NOTIFICATIONS_ENDPOINT =
  '/@angular-architects/native-federation:build-notifications';

interface AngularWorkspaceDocumentOptions {
  name: string;
  type: AtlasProjectType;
  profile: AngularVersionProfile;
  devServerPort?: number;
  stylesheetFormat?: AngularStylesheetFormat;
}

export function buildAngularWorkspaceDocument(
  options: AngularWorkspaceDocumentOptions,
): AngularWorkspaceDocument {
  const { name, type, profile } = options;
  const host = type === 'host';
  const devServerPort = options.devServerPort ?? getDefaultDevServerPort(type);
  const stylesheetFormat = options.stylesheetFormat ?? 'css';
  const originalDevServerPort = host
    ? deriveHostClientPortFromBootstrapPort(devServerPort)
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
            builder: selectNativeFederationBuilder(profile),
            options: { target: `${name}:esbuild:production` },
            configurations: {
              development: { target: `${name}:esbuild:development`, dev: true },
            },
          },
          serve: {
            builder: selectNativeFederationBuilder(profile),
            options: {
              target: `${name}:serve-original:development`,
              dev: true,
              port: devServerPort,
              ...(host
                ? {
                    buildNotifications: {
                      enable: true,
                      endpoint: ANGULAR_BUILD_NOTIFICATIONS_ENDPOINT,
                    },
                  }
                : {}),
            },
          },
          esbuild: {
            builder: '@angular-devkit/build-angular:application',
            options: {
              outputPath: `dist/${name}`,
              index: 'src/index.html',
              browser: 'src/main.ts',
              preserveSymlinks: false,
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

export function buildAngularAppTsconfig(): TsconfigDocument {
  return {
    extends: './tsconfig.json',
    compilerOptions: { outDir: './out-tsc/app' },
    files: ['src/main.ts', 'atlas.config.ts'],
    include: ['src/**/*.ts', '.atlas/**/*.ts'],
  };
}

export function buildAngularRootTsconfig(): TsconfigDocument {
  return {
    compilerOptions: {
      target: 'ES2022',
      module: 'ES2022',
      moduleResolution: 'bundler',
      strict: true,
      experimentalDecorators: true,
      useDefineForClassFields: false,
      lib: ['ES2022', 'DOM'],
      skipLibCheck: true,
    },
    angularCompilerOptions: {
      strictTemplates: true,
      strictInjectionParameters: true,
    },
  };
}

interface AngularFederationConfigOptions {
  name: string;
  type: AtlasProjectType;
  profile: AngularVersionProfile;
}

export function renderAngularFederationConfig(
  options: AngularFederationConfigOptions,
): string {
  const { name, type, profile } = options;

  if (usesNativeFederationV4ConfigApi(profile)) {
    return `import { createAngularV4FederationConfig } from "@atlas/sdk/federation-config";

export default await createAngularV4FederationConfig({
  projectRoot: import.meta.dirname,
  name: "${convertNameToFederationRemoteName(name)}",
  expose: "${type}",
  nativeFederationPackage: "${selectNativeFederationPackage(profile)}",
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: []
});
`;
  }

  return `const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "${convertNameToFederationRemoteName(name)}",
  expose: "${type}",
  // Add skip, exposes, shared, or other Native Federation options here.
  skip: []
});
`;
}

export function selectAngularFederationConfigFileName(
  profile: AngularVersionProfile,
): string {
  return usesNativeFederationV4ConfigApi(profile)
    ? 'federation.config.mjs'
    : 'federation.config.js';
}
