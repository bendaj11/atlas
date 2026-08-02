import type { AtlasGeneratedFile } from '@atlas/generators';
import type { SupportedFramework } from '../cli/arguments.js';

const ATLAS_INTEGRATION_FILES = new Set([
  'atlas.config.ts',
  'federation.config.js',
  'federation.config.mjs',
]);
const ATLAS_HOST_FILES = new Set([
  ...ATLAS_INTEGRATION_FILES,
  'atlas.bootstrap.html',
]);

const DELEGATED_HOST_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_HOST_FILES,
    'src/index.html',
    'src/app/app.component.ts',
    'src/app/app.config.ts',
    'src/app/app.routes.ts',
    'src/main.ts',
    'src/bootstrap.ts',
  ]),
  react: new Set([
    ...ATLAS_HOST_FILES,
    'vite.config.ts',
    'index.html',
    'src/styles.css',
    'src/main.tsx',
    'src/bootstrap.tsx',
  ]),
};

const DELEGATED_APP_FILES: Record<SupportedFramework, ReadonlySet<string>> = {
  angular: new Set([
    ...ATLAS_INTEGRATION_FILES,
    'src/index.html',
    'src/main.ts',
    'src/entry.ts',
    'src/app/app.component.ts',
    'src/app/app.config.ts',
    'src/app/home/home.component.ts',
    'src/app/details/details.component.ts',
    'src/app/app.routes.ts',
    'src/exported-widgets/README.md',
  ]),
  react: new Set([
    ...ATLAS_INTEGRATION_FILES,
    'vite.config.ts',
    'index.html',
    'src/App.tsx',
    'src/home/Home.tsx',
    'src/details/Details.tsx',
    'src/routes.tsx',
    'src/index.css',
    'src/bootstrap.tsx',
    'src/exported-widgets/README.md',
  ]),
};

export function generatedOverlay(
  files: AtlasGeneratedFile[],
  workspaceScaffolded: boolean,
  type: 'host' | 'app',
  framework: SupportedFramework,
): AtlasGeneratedFile[] {
  if (!workspaceScaffolded) return files;
  const overlay =
    type === 'host'
      ? DELEGATED_HOST_FILES[framework]
      : DELEGATED_APP_FILES[framework];
  return files.filter(
    (file) =>
      overlay.has(file.path) || isAngularStylesheet(file.path, framework),
  );
}

function isAngularStylesheet(
  path: string,
  framework: SupportedFramework,
): boolean {
  return (
    framework === 'angular' && /^src\/styles\.(css|scss|sass|less)$/u.test(path)
  );
}
