import { expect, test } from '@jest/globals';
import {
  generateReactAppFiles,
  generateReactHostFiles,
} from './react-generator.js';

test('React host pins matching runtime versions', () => {
  expect(reactDependencies(generateReactHostFiles(options(), 'host'))).toEqual({
    react: '19.2.8',
    'react-dom': '19.2.8',
  });
});

test('React app pins matching runtime versions', () => {
  expect(reactDependencies(generateReactAppFiles(options()))).toEqual({
    react: '19.2.8',
    'react-dom': '19.2.8',
  });
});

test.each<[packageManager: 'npm' | 'pnpm', commandPrefix: string]>([
  ['npm', 'npx --no-install'],
  ['pnpm', 'pnpm exec'],
])(
  'should use local Atlas CLI when package manager is %s',
  (packageManager, commandPrefix) => {
    expect(
      atlasScripts(generateReactAppFiles(options(packageManager))),
    ).toEqual({
      dev: `${commandPrefix} atlas dev orders`,
      publish: `${commandPrefix} atlas publish orders`,
    });
  },
);

function options(packageManager?: 'npm' | 'pnpm') {
  return {
    name: 'orders',
    framework: 'react' as const,
    frameworkVersion: '^19.2.8',
    packageManager,
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
    publish: packageJson.scripts['atlas:publish'],
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
