import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  createReactAppViteConfig,
  createReactHostViteConfig,
} from '@atlas/sdk/federation-config';
import { expect, jest, test } from '@jest/globals';

const executeFile = promisify(execFile);
const factoryPath = fileURLToPath(
  new URL('../federation-config.cjs', import.meta.url),
);
const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url));

interface AtlasVitePlugin {
  readonly name: string;
  readonly transform?: (code: string, id: string) => string | undefined;
  readonly handleHotUpdate?: (context: {
    file: string;
    server: { ws: { send: (event: unknown) => void } };
  }) => unknown;
  readonly configureServer?: (server: {
    middlewares: { use: (path: string, handler: Middleware) => void };
  }) => void;
}

type Middleware = (
  request: unknown,
  response: {
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
) => void;

test('Angular host federation exposes workspace-relative source', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/hosts/demo-angular-host', import.meta.url),
  );
  const exposes = await federationExposes(projectRoot, 'host');

  expect(exposes).toStrictEqual({
    './host': './examples/hosts/demo-angular-host/src/host.ts',
  });
  await expectSourcesToResolve(exposes);
});

test('Angular app federation exposes workspace-relative entry and widgets', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/orders-angular', import.meta.url),
  );
  const exposes = await federationExposes(projectRoot, 'app');

  expect(exposes).toStrictEqual({
    './entry': './examples/apps/orders-angular/src/entry.ts',
    './widgets/order-status':
      './examples/apps/orders-angular/.atlas/widgets/order-status.ts',
  });
  await expectSourcesToResolve(exposes);
  const widgetEntry = await readFile(
    resolve(workspaceRoot, exposes['./widgets/order-status']),
    'utf8',
  );
  expect(widgetEntry).toMatch(/createExportedWidget\(Widget\)/);
  expect(widgetEntry).toMatch(/src\/exported-widgets\/order-status\/index/);
});

test('React federation generates ignored widget lifecycle entries', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/catalog-react', import.meta.url),
  );
  const script = [
    `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
    `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify({ projectRoot, reactMajor: 19 })})));`,
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  const entries = JSON.parse(stdout) as Array<{
    name: string;
    entryPoint: string;
  }>;
  const productCount = entries.find((entry) => entry.name === 'product-count');

  expect(productCount).toBeDefined();
  const source = await readFile(
    resolve(projectRoot, productCount!.entryPoint),
    'utf8',
  );
  expect(source).toMatch(/defineExportedWidget/);
  expect(source).toMatch(/src\/exported-widgets\/product-count\/index/);
});

test('React 17 federation uses legacy root lifecycle internally', async () => {
  const projectRoot = fileURLToPath(
    new URL('../../../examples/apps/catalog-react', import.meta.url),
  );
  const script = [
    `const { createReactWidgetEntries } = require(${JSON.stringify(factoryPath)});`,
    `process.stdout.write(JSON.stringify(createReactWidgetEntries(${JSON.stringify({ projectRoot, reactMajor: 17 })})));`,
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  const [entry] = JSON.parse(stdout) as Array<{ entryPoint: string }>;
  const source = await readFile(resolve(projectRoot, entry.entryPoint), 'utf8');

  expect(source).toMatch(/unmountComponentAtNode/);
  expect(source).not.toMatch(/react-dom\/client/);
});

test('React app Vite factory owns federation build and development behavior', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'atlas-react-vite-app-'));
  await mkdir(join(projectRoot, 'src/exported-widgets/summary'), {
    recursive: true,
  });
  const config = createReactAppViteConfig({
    projectRoot,
    projectName: 'order-history',
    reactMajor: 19,
  });
  const plugins = config.plugins as AtlasVitePlugin[];

  expect(plugins.map(({ name }) => name)).toStrictEqual([
    'atlas-react-refresh-preamble',
    'atlas-react-source-reload',
    'atlas-native-federation-metadata',
  ]);
  expect(
    plugins[0]?.transform?.(
      'export default {};',
      join(projectRoot, 'src/entry.tsx'),
    ),
  ).toMatch(/plugin-react\/preamble/);

  const send = jest.fn();
  expect(
    plugins[1]?.handleHotUpdate?.({
      file: join(projectRoot, 'src/entry.tsx'),
      server: { ws: { send } },
    }),
  ).toStrictEqual([]);
  expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '*' });

  send.mockClear();
  expect(
    plugins[1]?.handleHotUpdate?.({
      file: join(projectRoot, 'src/app/OrderSummary.tsx'),
      server: { ws: { send } },
    }),
  ).toStrictEqual([]);
  expect(send).toHaveBeenCalledWith({ type: 'full-reload', path: '*' });

  send.mockClear();
  expect(
    plugins[1]?.handleHotUpdate?.({
      file: join(projectRoot, 'README.md'),
      server: { ws: { send } },
    }),
  ).toBeUndefined();
  expect(send).not.toHaveBeenCalled();

  const rollupOptions = config.build?.rollupOptions as {
    input: Record<string, string>;
  };
  expect(Object.keys(rollupOptions.input)).toStrictEqual([
    'entry',
    'widgets/summary',
  ]);
});

test('React host Vite factory serves Atlas metadata', () => {
  const projectRoot = resolve(workspaceRoot, 'examples/hosts/demo-react-host');
  const config = createReactHostViteConfig({
    projectRoot,
    projectName: 'demo-react-host',
  });
  const [metadataPlugin] = config.plugins as AtlasVitePlugin[];
  let middleware: Middleware | undefined;
  metadataPlugin?.configureServer?.({
    middlewares: {
      use(path, handler) {
        expect(path).toBe('/remoteEntry.json');
        middleware = handler;
      },
    },
  });
  let body = '';
  middleware?.(
    {},
    {
      setHeader() {},
      end(value) {
        body = value;
      },
    },
  );

  expect(JSON.parse(body)).toStrictEqual({
    name: 'atlas_demo_react_host',
    exposes: [{ key: './host', outFileName: 'src/host.tsx' }],
    shared: [],
  });
});

async function federationExposes(
  projectRoot: string,
  expose: 'host' | 'app',
): Promise<Record<string, string>> {
  const script = [
    `const { createAngularFederationConfig } = require(${JSON.stringify(factoryPath)});`,
    `const config = createAngularFederationConfig(${JSON.stringify({ projectRoot, name: 'test', expose })});`,
    'process.stdout.write(JSON.stringify(config.exposes));',
  ].join('\n');
  const { stdout } = await executeFile(process.execPath, ['-e', script], {
    cwd: workspaceRoot,
  });
  return JSON.parse(stdout) as Record<string, string>;
}

async function expectSourcesToResolve(
  exposes: Record<string, string>,
): Promise<void> {
  await Promise.all(
    Object.values(exposes).map((source) =>
      access(resolve(workspaceRoot, source)),
    ),
  );
}
