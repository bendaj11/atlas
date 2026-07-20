const {
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} = require('node:fs');
const { createRequire } = require('node:module');
const { join, relative, resolve } = require('node:path');

function sourcePath(projectRoot, path) {
  const pathFromWorkspace = relative(
    process.cwd(),
    join(projectRoot, 'src', path),
  ).replaceAll('\\', '/');
  return pathFromWorkspace.startsWith('.')
    ? pathFromWorkspace
    : `./${pathFromWorkspace}`;
}

function projectPath(projectRoot, path) {
  const pathFromWorkspace = relative(
    process.cwd(),
    join(projectRoot, path),
  ).replaceAll('\\', '/');
  return pathFromWorkspace.startsWith('.')
    ? pathFromWorkspace
    : `./${pathFromWorkspace}`;
}

function widgetNames(projectRoot) {
  const widgetsRoot = join(projectRoot, 'src/exported-widgets');
  return existsSync(widgetsRoot)
    ? readdirSync(widgetsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
    : [];
}

function writeWidgetEntry(projectRoot, name, extension, contents) {
  const generatedDirectory = join(projectRoot, '.atlas/widgets');
  mkdirSync(generatedDirectory, { recursive: true });
  const relativeEntryPoint = `.atlas/widgets/${name}.${extension}`;
  writeFileSync(join(projectRoot, relativeEntryPoint), contents);
  return relativeEntryPoint;
}

function createAngularWidgetEntries(projectRoot) {
  return widgetNames(projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry(
      projectRoot,
      name,
      'ts',
      `import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${JSON.stringify(`../../src/exported-widgets/${name}/index`)};

export default createExportedWidget(Widget);
`,
    ),
  }));
}

function createReactWidgetEntries(options) {
  return widgetNames(options.projectRoot).map((name) => ({
    name,
    entryPoint: writeWidgetEntry(
      options.projectRoot,
      name,
      'tsx',
      reactWidgetEntry(name, options.reactMajor),
    ),
  }));
}

function reactRemoteName(name) {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

function federationMetadataPlugin(options) {
  return {
    name: options.pluginName,
    configureServer(server) {
      server.middlewares.use('/remoteEntry.json', (_request, response) => {
        response.setHeader('content-type', 'application/json');
        response.setHeader('access-control-allow-origin', '*');
        response.end(
          JSON.stringify({ ...options.metadata, exposes: options.devExposes }),
        );
      });
    },
    closeBundle() {
      writeFileSync(
        resolve(options.projectRoot, 'dist/remoteEntry.json'),
        JSON.stringify(options.metadata, null, 2),
      );
    },
  };
}

function reactRefreshPreamblePlugin(sourceEntries) {
  return {
    name: 'atlas-react-refresh-preamble',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const sourcePath = id.split('?')[0].replaceAll('\\', '/');
      if (!sourceEntries.some((entryPoint) => sourcePath.endsWith(entryPoint)))
        return;
      return `import "@vitejs/plugin-react/preamble";\n${code}`;
    },
  };
}

function reactSourceReloadPlugin(projectRoot) {
  const sourceRoot = `${resolve(projectRoot, 'src').replaceAll('\\', '/')}/`;
  return {
    name: 'atlas-react-source-reload',
    apply: 'serve',
    handleHotUpdate({ file, server }) {
      const sourceFile = file.replaceAll('\\', '/');
      if (
        !sourceFile.startsWith(sourceRoot) ||
        !/\.[cm]?[jt]sx?$/.test(sourceFile)
      )
        return;
      server.ws.send({ type: 'full-reload', path: '*' });
      return [];
    },
  };
}

function createReactHostViteConfig(options) {
  const metadata = {
    name: reactRemoteName(options.projectName),
    exposes: [{ key: './host', outFileName: 'host.js' }],
    shared: [],
  };
  return {
    plugins: [
      federationMetadataPlugin({
        projectRoot: options.projectRoot,
        pluginName: 'atlas-host-metadata',
        metadata,
        devExposes: [{ key: './host', outFileName: 'src/host.tsx' }],
      }),
    ],
    build: {
      target: 'esnext',
      rollupOptions: {
        input: { host: resolve(options.projectRoot, 'src/host.tsx') },
        output: {
          entryFileNames: 'host.js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        preserveEntrySignatures: 'exports-only',
      },
    },
  };
}

function createReactAppViteConfig(options) {
  const widgetEntries = createReactWidgetEntries(options);
  const exposes = [
    { key: './entry', outFileName: 'entry.js' },
    ...widgetEntries.map(({ name }) => ({
      key: `./widgets/${name}`,
      outFileName: `widgets/${name}.js`,
    })),
  ];
  const metadata = {
    name: reactRemoteName(options.projectName),
    exposes,
    shared: [],
  };
  const sourceEntries = [
    'src/entry.tsx',
    ...widgetEntries.map(({ entryPoint }) => entryPoint),
  ];
  return {
    plugins: [
      reactRefreshPreamblePlugin(sourceEntries),
      reactSourceReloadPlugin(options.projectRoot),
      federationMetadataPlugin({
        projectRoot: options.projectRoot,
        pluginName: 'atlas-native-federation-metadata',
        metadata,
        devExposes: [
          {
            key: './entry',
            outFileName: 'src/entry.tsx',
            dev: { entryPoint: 'src/entry.tsx' },
          },
          ...widgetEntries.map(({ name, entryPoint }) => ({
            key: `./widgets/${name}`,
            outFileName: entryPoint,
            dev: { entryPoint },
          })),
        ],
      }),
    ],
    build: {
      target: 'esnext',
      rollupOptions: {
        input: Object.fromEntries([
          ['entry', resolve(options.projectRoot, 'src/entry.tsx')],
          ...widgetEntries.map(({ name, entryPoint }) => [
            `widgets/${name}`,
            resolve(options.projectRoot, entryPoint),
          ]),
        ]),
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        preserveEntrySignatures: 'exports-only',
      },
    },
  };
}

function reactWidgetEntry(name, reactMajor) {
  const rootAdapter =
    reactMajor === 17
      ? `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) { render(element, container); },
    unmount() { unmountComponentAtNode(container); }
  };
}`
      : `import { createRoot } from "react-dom/client";`;
  return `import { createElement, type ComponentProps } from "react";
${rootAdapter}
import { defineExportedWidget } from "@atlas/sdk/react";
import Widget from ${JSON.stringify(`../../src/exported-widgets/${name}/index`)};

export default defineExportedWidget({
  createRoot,
  createElement: ({ props }) => createElement(Widget, props as ComponentProps<typeof Widget>)
});
`;
}

function createAngularFederationConfig(options) {
  const requireFromProject = createRequire(
    join(options.projectRoot, 'package.json'),
  );
  const { withNativeFederation } = requireFromProject(
    '@angular-architects/native-federation/config',
  );
  const widgetExposes = Object.fromEntries(
    createAngularWidgetEntries(options.projectRoot).map((entry) => [
      `./widgets/${entry.name}`,
      projectPath(options.projectRoot, entry.entryPoint),
    ]),
  );

  return withNativeFederation({
    name: options.name,
    exposes:
      options.expose === 'host'
        ? { './host': sourcePath(options.projectRoot, 'host.ts') }
        : options.expose === 'app'
          ? {
              './entry': sourcePath(options.projectRoot, 'entry.ts'),
              ...widgetExposes,
            }
          : {},
    shared: {},
    skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],
  });
}

module.exports = {
  createAngularFederationConfig,
  createReactAppViteConfig,
  createReactHostViteConfig,
  createReactWidgetEntries,
};
