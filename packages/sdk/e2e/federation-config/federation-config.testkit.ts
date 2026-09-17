import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

export type ExampleProject =
  | 'hosts/demo-angular-host'
  | 'apps/orders-angular'
  | 'apps/catalog-react'
  | 'hosts/demo-react-host';

const executeFile = promisify(execFile);

export const FACTORY_PATH = fileURLToPath(
  new URL('../../federation-config.cjs', import.meta.url),
);
export const WORKSPACE_ROOT = fileURLToPath(
  new URL('../../../..', import.meta.url),
);

export function exampleProjectRoot(project: ExampleProject): string {
  return resolve(WORKSPACE_ROOT, 'examples', project);
}

/** Runs a CommonJS snippet against the packaged factory in a child process and parses its stdout as JSON. */
export async function runFactoryScript<T>(
  lines: readonly string[],
): Promise<T> {
  const script = [
    `const factory = require(${JSON.stringify(FACTORY_PATH)});`,
    ...lines,
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: WORKSPACE_ROOT,
  });

  return JSON.parse(stdout) as T;
}

/** Paths that do not exist, resolved from `root`. */
export async function missingFiles(
  root: string,
  paths: readonly string[],
): Promise<string[]> {
  const checks = await Promise.all(
    paths.map((path) =>
      access(resolve(root, path)).then(
        () => undefined,
        () => path,
      ),
    ),
  );

  return checks.filter((path): path is string => path !== undefined);
}

/** A React app with one exported widget and a trivial bootstrap, in a temp directory. */
export async function anEmptyReactProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'atlas-react-vite-app-'));
  await mkdir(join(projectRoot, 'src/exported-widgets/summary'), {
    recursive: true,
  });
  await writeFile(
    join(projectRoot, 'src/bootstrap.tsx'),
    'export default {};\n',
  );

  return projectRoot;
}

interface FixturePackage {
  readonly packageName: string;
  readonly version: string;
  readonly exports: readonly string[];
}

/** A React app whose entry imports every kind of dependency the sharing discovery must classify. */
export async function aReactFederationFixture(): Promise<string> {
  const projectRoot = await mkdtemp(
    join(tmpdir(), 'atlas-react-auto-sharing-'),
  );
  await mkdir(join(projectRoot, 'src'), { recursive: true });
  await writeJson(join(projectRoot, 'package.json'), {
    name: 'automatic-sharing-fixture',
    private: true,
    type: 'module',
    dependencies: {
      '@atlas/sdk': '*',
      '@company/design-system': '^4.2.0',
      'cjs-lib': '^1.0.0',
      'comment-only': '^1.0.0',
      'lazy-lib': '^2.0.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
      'side-effects': '^3.0.0',
      'style-lib': '^1.0.0',
      'types-only': '^1.0.0',
      'unused-lib': '^1.0.0',
    },
    peerDependencies: { 'peer-lib': '^5.0.0' },
  });
  await writeJson(join(projectRoot, 'tsconfig.json'), {
    compilerOptions: {
      allowJs: true,
      baseUrl: '.',
      jsx: 'react-jsx',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      paths: { '@app/*': ['src/*'] },
    },
  });
  await writeFile(
    join(projectRoot, 'src/entry.tsx'),
    [
      'import { createElement } from "react";',
      'import { createRoot } from "react-dom/client";',
      'import type { TypeOnly } from "types-only";',
      'import { Button } from "@company/design-system/button";',
      'import "@company/design-system/theme";',
      'import { named } from "cjs-lib";',
      'import "style-lib/styles.css";',
      'import { feature } from "@app/feature";',
      'import "peer-lib";',
      '// import "comment-only";',
      'const computedPackage = "unused-lib";',
      'export const computed = () => import(computedPackage);',
      'export const lazy = () => import("lazy-lib/modal");',
      'export default { Button, createElement, createRoot, feature, named };',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(projectRoot, 'src/feature.ts'),
    [
      'import "side-effects";',
      'export type { TypeOnly } from "types-only";',
      'export const feature = true;',
      '',
    ].join('\n'),
  );
  const packages: FixturePackage[] = [
    {
      packageName: 'react',
      version: '19.2.0',
      exports: ['.', './jsx-runtime', './jsx-dev-runtime'],
    },
    { packageName: 'react-dom', version: '19.2.0', exports: ['.', './client'] },
    {
      packageName: '@atlas/sdk',
      version: '0.3.21',
      exports: [
        '.',
        './federation',
        './host',
        './lifecycle',
        './navigation',
        './react',
      ],
    },
    {
      packageName: '@company/design-system',
      version: '4.2.3',
      exports: ['./button', './theme'],
    },
    { packageName: 'lazy-lib', version: '2.1.0', exports: ['./modal'] },
    { packageName: 'peer-lib', version: '5.1.0', exports: ['.'] },
    { packageName: 'side-effects', version: '3.0.1', exports: ['.'] },
    { packageName: 'types-only', version: '1.0.0', exports: ['.'] },
    { packageName: 'unused-lib', version: '1.0.0', exports: ['.'] },
    { packageName: 'comment-only', version: '1.0.0', exports: ['.'] },
  ];
  for (const fixture of packages)
    await createFixturePackage(projectRoot, fixture);
  await createCommonJsFixturePackage(projectRoot);
  await createStyleFixturePackage(projectRoot);

  return projectRoot;
}

async function createStyleFixturePackage(projectRoot: string): Promise<void> {
  const packageRoot = join(projectRoot, 'node_modules/style-lib');
  await mkdir(packageRoot, { recursive: true });
  await writeJson(join(packageRoot, 'package.json'), {
    name: 'style-lib',
    version: '1.0.0',
    exports: { './styles.css': './styles.css' },
  });
  await writeFile(
    join(packageRoot, 'styles.css'),
    '.fixture { color: red; }\n',
  );
}

async function createCommonJsFixturePackage(
  projectRoot: string,
): Promise<void> {
  const packageRoot = join(projectRoot, 'node_modules/cjs-lib');
  await mkdir(packageRoot, { recursive: true });
  await writeJson(join(packageRoot, 'package.json'), {
    name: 'cjs-lib',
    version: '1.0.0',
    main: './index.js',
  });
  await writeFile(
    join(packageRoot, 'index.js'),
    'exports.named = "named CommonJS export";\n',
  );
}

async function createFixturePackage(
  projectRoot: string,
  fixture: FixturePackage,
): Promise<void> {
  const packageRoot = join(projectRoot, 'node_modules', fixture.packageName);
  await mkdir(packageRoot, { recursive: true });
  const packageExports = Object.fromEntries(
    fixture.exports.map((specifier) => [
      specifier,
      `./${specifier === '.' ? 'index.js' : `${specifier.slice(2).replaceAll('/', '-')}.js`}`,
    ]),
  );
  await writeJson(join(packageRoot, 'package.json'), {
    name: fixture.packageName,
    version: fixture.version,
    type: 'module',
    exports: packageExports,
  });
  await Promise.all(
    Object.values(packageExports).map((fileName) =>
      writeFile(
        join(packageRoot, fileName.slice(2)),
        [
          `export const value = ${JSON.stringify(`${fixture.packageName}:${fileName}`)};`,
          'export const Button = value;',
          'export const createElement = () => value;',
          'export const createRoot = () => value;',
          'export default value;',
          '',
        ].join('\n'),
      ),
    ),
  );
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
