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

function options() {
  return { name: 'orders', framework: 'angular' as const };
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
