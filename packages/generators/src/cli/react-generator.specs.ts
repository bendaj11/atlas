import { expect, test } from '@jest/globals';
import {
  generateReactAppFiles,
  generateReactHostFiles,
} from './react-generator.js';

test('should pin matching runtime versions when generating a React host', () => {
  expect(reactDependencies(generateReactHostFiles(options(), 'host'))).toEqual({
    react: '19.2.8',
    'react-dom': '19.2.8',
  });
});

test('should pin matching runtime versions when generating a React app', () => {
  expect(reactDependencies(generateReactAppFiles(options()))).toEqual({
    react: '19.2.8',
    'react-dom': '19.2.8',
  });
});

test('should use local Atlas commands when generating an app', () => {
  expect(atlasScripts(generateReactAppFiles(options()))).toEqual({
    dev: 'atlas dev orders',
    config: 'atlas compile-config orders',
    publish: 'atlas publish orders',
  });
});

test('should use local Atlas commands when generating a host', () => {
  expect(atlasScripts(generateReactHostFiles(options(), 'host-id'))).toEqual({
    dev: 'atlas dev orders',
    config: 'atlas compile-config orders',
    publish: 'atlas publish orders',
    bootstrap: 'atlas bootstrap orders --skip-compile',
  });
});

test('should include an empty preview array when generating an app', () => {
  expect(atlasPreviews(generateReactAppFiles(options()))).toEqual([]);
});

test('should include an empty preview array when generating a host', () => {
  expect(atlasPreviews(generateReactHostFiles(options(), 'host-id'))).toEqual(
    [],
  );
});

function options() {
  return {
    name: 'orders',
    framework: 'react' as const,
    frameworkVersion: '^19.2.8',
  };
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
    config: packageJson.scripts['atlas:config'],
    publish: packageJson.scripts['atlas:publish'],
    ...(packageJson.scripts['atlas:bootstrap']
      ? { bootstrap: packageJson.scripts['atlas:bootstrap'] }
      : {}),
  };
}

function reactDependencies(files: { path: string; contents: string }[]) {
  const packageFile = files.find((file) => file.path === 'package.json');
  if (!packageFile)
    throw new Error('Generated project must have package.json.');
  const packageJson = JSON.parse(packageFile.contents) as {
    dependencies: Record<string, string>;
  };
  return {
    react: packageJson.dependencies.react,
    'react-dom': packageJson.dependencies['react-dom'],
  };
}

function atlasPreviews(files: { path: string; contents: string }[]): unknown[] {
  const packageFile = files.find((file) => file.path === 'package.json');
  if (!packageFile)
    throw new Error('Generated project must have package.json.');

  const packageJson = JSON.parse(packageFile.contents) as {
    atlas: { previews: unknown[] };
  };
  return packageJson.atlas.previews;
}
