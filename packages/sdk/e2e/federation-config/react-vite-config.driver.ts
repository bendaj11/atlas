import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { jest } from '@jest/globals';
import { build as buildVite, type Plugin, type UserConfig } from 'vite';
import type { SkipEntry } from '../../federation-config.cjs';
import {
  anEmptyReactProject,
  aReactFederationFixture,
  exampleProjectRoot,
  FACTORY_PATH,
  missingFiles,
  runFederationFactoryScript,
  type ExampleProject,
} from './federation-config.testkit.js';

type FederationConfigModule = typeof import('../../federation-config.cjs');

interface FederationMetadata {
  readonly name: string;
  readonly exposes: ReadonlyArray<{ key: string; outFileName: string }>;
  readonly shared: ReadonlyArray<{
    packageName: string;
    outFileName: string;
    requiredVersion: string;
    singleton: boolean;
    strictVersion: boolean;
    version: string;
  }>;
}

interface GeneratedWidgetEntry {
  readonly name: string;
  readonly entryPoint: string;
}

type Middleware = (
  request: unknown,
  response: {
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
) => void;

const { createReactAppViteConfig, createReactHostViteConfig } = createRequire(
  import.meta.url,
)(FACTORY_PATH) as FederationConfigModule;

export class ReactViteConfigDriver {
  private readonly send = jest.fn<(event: unknown) => void>();
  private projectRoot = '';
  private projectName = 'automatic-sharing';
  private reactMajor = 19;
  private skip: readonly SkipEntry[] = [];
  private config: UserConfig | undefined;
  private widgetEntries: GeneratedWidgetEntry[] = [];
  private hotUpdateResult: unknown;

  readonly given = {
    exampleProject: (project: ExampleProject): this => {
      this.projectRoot = exampleProjectRoot(project);
      this.projectName = project.split('/')[1] ?? project;

      return this;
    },
    fixtureProject: async (): Promise<this> => {
      this.projectRoot = await aReactFederationFixture();

      return this;
    },
    emptyProject: async (): Promise<this> => {
      this.projectRoot = await anEmptyReactProject();

      return this;
    },
    entrySource: async (source: string): Promise<this> => {
      await writeFile(join(this.projectRoot, 'src/entry.tsx'), source);

      return this;
    },
    reactMajor: (reactMajor: number): this => {
      this.reactMajor = reactMajor;

      return this;
    },
    skip: (skip: readonly SkipEntry[]): this => {
      this.skip = skip;

      return this;
    },
  };

  readonly when = {
    widgetEntriesCreated: async (): Promise<void> => {
      const options = {
        projectRoot: this.projectRoot,
        reactMajor: this.reactMajor,
      };
      this.widgetEntries = await runFederationFactoryScript<
        GeneratedWidgetEntry[]
      >([
        `process.stdout.write(JSON.stringify(factory.createReactWidgetEntries(${JSON.stringify(options)})));`,
      ]);
    },
    appConfigCreated: (): void => {
      this.config = createReactAppViteConfig({
        projectRoot: this.projectRoot,
        projectName: this.projectName,
        reactMajor: this.reactMajor,
        skip: this.skip,
      });
    },
    hostConfigCreated: (): void => {
      this.config = createReactHostViteConfig({
        projectRoot: this.projectRoot,
        projectName: this.projectName,
      });
    },
    hotUpdateHandled: (file: string): void => {
      const plugin = this.findPlugin('atlas-react-source-reload');
      const handleHotUpdate = plugin.handleHotUpdate as (
        context: unknown,
      ) => unknown;

      this.hotUpdateResult = handleHotUpdate({
        file: join(this.projectRoot, file),
        server: { ws: { send: this.send } },
      });
    },
    productionBuilt: async (): Promise<void> => {
      await buildVite({
        ...this.config,
        configFile: false,
        root: this.projectRoot,
        logLevel: 'silent',
        resolve: { alias: { '@app': join(this.projectRoot, 'src') } },
      });
    },
  };

  readonly get = {
    widgetEntrySource: (name: string): Promise<string> => {
      const entry = this.widgetEntries.find(
        (candidate) => candidate.name === name,
      );

      if (!entry) throw new Error(`Widget entry "${name}" was not generated.`);

      return readFile(resolve(this.projectRoot, entry.entryPoint), 'utf8');
    },
    pluginNames: (): string[] =>
      (this.config?.plugins as Plugin[]).map(({ name }) => name),
    rollupInputNames: (): string[] =>
      Object.keys(
        this.config?.build?.rollupOptions?.input as Record<string, string>,
      ),
    external: (source: string): boolean =>
      (
        this.config?.build?.rollupOptions?.external as (
          source: string,
        ) => boolean
      )(source),
    servedMetadata: (pluginName: string): FederationMetadata =>
      this.readServedMetadata(pluginName),
    sharedPackageNames: (): string[] =>
      this.readServedMetadata('atlas-native-federation-metadata').shared.map(
        ({ packageName }) => packageName,
      ),
    sendMock: (): jest.Mock<(event: unknown) => void> => this.send,
    hotUpdateResult: (): unknown => this.hotUpdateResult,
    projectFile: (path: string): Promise<string> =>
      readFile(join(this.projectRoot, path), 'utf8'),
    distModule: (path: string): Promise<Record<string, unknown>> =>
      import(pathToFileURL(join(this.projectRoot, 'dist', path)).href),
    missingDistFiles: (paths: readonly string[]): Promise<string[]> =>
      missingFiles(join(this.projectRoot, 'dist'), paths),
  };

  private findPlugin(name: string): Plugin {
    const plugin = (this.config?.plugins as Plugin[]).find(
      (entry) => entry.name === name,
    );

    if (!plugin) throw new Error(`Vite plugin "${name}" was not configured.`);

    return plugin;
  }

  private readServedMetadata(pluginName: string): FederationMetadata {
    const plugin = this.findPlugin(pluginName);
    let middleware: Middleware | undefined;
    (plugin.configureServer as (server: unknown) => void)({
      middlewares: {
        use: (_path: string, handler: Middleware) => {
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

    if (!body) {
      throw new Error('Federation metadata middleware was not installed.');
    }

    return JSON.parse(body) as FederationMetadata;
  }
}
