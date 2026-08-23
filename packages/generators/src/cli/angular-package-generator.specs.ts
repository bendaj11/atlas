import { expect, test } from '@jest/globals';
import {
  generateAngularAppFiles,
  generateAngularHostFiles,
} from './angular-generator.js';

test('should use caret Angular dependency versions when generating an app', () => {
  expect(angularVersions(generateAngularAppFiles(options()))).toEqual([
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
  ]);
});

test('should use caret Angular dependency versions when generating a host', () => {
  expect(
    angularVersions(generateAngularHostFiles(options(), 'host-id')),
  ).toEqual([
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
    '^20.3.0',
  ]);
});

test.each<[packageManager: 'npm' | 'pnpm', commandPrefix: string]>([
  ['npm', 'npx --no-install'],
  ['pnpm', 'pnpm exec'],
])(
  'should use local Atlas CLI when package manager is %s',
  (packageManager, commandPrefix) => {
    expect(
      atlasScripts(generateAngularAppFiles(options(packageManager))),
    ).toEqual({
      dev: `${commandPrefix} atlas dev orders`,
      publish: `${commandPrefix} atlas publish orders`,
    });
  },
);

function options(packageManager?: 'npm' | 'pnpm') {
  return { name: 'orders', framework: 'angular' as const, packageManager };
}

function angularVersions(
  files: { path: string; contents: string }[],
): string[] {
  const packageFile = files.find((file) => file.path === 'package.json');
  if (!packageFile)
    throw new Error('Generated project must have package.json.');

  const packageJson = JSON.parse(packageFile.contents) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  return [
    ...Object.entries(packageJson.dependencies),
    ...Object.entries(packageJson.devDependencies),
  ]
    .filter(([name]) => name.startsWith('@angular/'))
    .map(([, version]) => version);
}

function atlasScripts(files: { path: string; contents: string }[]) {
  const packageFile = files.find((file) => file.path === 'package.json');
  if (!packageFile)
    throw new Error('Generated project must have package.json.');

  const packageJson = JSON.parse(packageFile.contents) as {
    scripts: Record<string, string>;
  };
  return {
    dev: packageJson.scripts.dev,
    publish: packageJson.scripts['atlas:publish'],
  };
}
