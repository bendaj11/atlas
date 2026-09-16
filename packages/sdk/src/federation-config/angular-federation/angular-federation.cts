import { createRequire } from 'node:module';
import { join } from 'node:path';
import { workspaceRelativePath } from '../project-paths/project-paths.cjs';
import { createAngularWidgetEntries } from '../widget-entries/widget-entries.cjs';

export type AngularProjectExpose = 'host' | 'app';

export interface AngularFederationConfigOptions {
  readonly projectRoot: string;
  /** Native Federation remote name. */
  readonly name: string;
  /** Selects the Atlas entries to expose: `./host` for a host, `./entry` plus widgets for an app. */
  readonly expose?: AngularProjectExpose;
  readonly exposes?: Readonly<Record<string, string>>;
  readonly shared?: Readonly<Record<string, unknown>>;
  readonly skip?: readonly string[];
  /** Any further option is forwarded to `withNativeFederation` untouched. */
  readonly [nativeFederationOption: string]: unknown;
}

export interface AngularFederationOptions {
  readonly name: string;
  readonly exposes: Readonly<Record<string, string>>;
  readonly shared: Readonly<Record<string, unknown>>;
  readonly skip: readonly string[];
  readonly [nativeFederationOption: string]: unknown;
}

export type ShareAll = (
  config: typeof ANGULAR_SHARED_DEPENDENCY_OPTIONS,
  options: {
    readonly projectPath: string;
    readonly overrides: Readonly<Record<string, unknown>>;
  },
) => Readonly<Record<string, unknown>>;

interface NativeFederationConfigModule {
  readonly shareAll: ShareAll;
  readonly withNativeFederation: (options: AngularFederationOptions) => unknown;
}

const ANGULAR_FEDERATION_SKIP = [
  '@atlas/runtime/react',
  '@atlas/sdk/react',
  'rxjs/ajax',
  'rxjs/fetch',
  'rxjs/testing',
  'rxjs/webSocket',
];
const ANGULAR_SHARED_DEPENDENCY_OPTIONS = Object.freeze({
  singleton: true,
  strictVersion: true,
  requiredVersion: 'auto',
});

/** Native Federation config for `@angular-architects/native-federation` v18-v20 (synchronous `config` export). */
export function createAngularFederationConfig(
  options: AngularFederationConfigOptions,
): unknown {
  const requireFromProject = createRequire(
    join(options.projectRoot, 'package.json'),
  );
  const { shareAll, withNativeFederation } = requireFromProject(
    '@angular-architects/native-federation/config',
  ) as NativeFederationConfigModule;

  return withNativeFederation(
    createAngularFederationOptions(options, shareAll),
  );
}

/** Builds the `withNativeFederation` options: Atlas exposes plus shared Angular packages. */
export function createAngularFederationOptions(
  options: AngularFederationConfigOptions,
  shareAll: ShareAll,
): AngularFederationOptions {
  const {
    projectRoot,
    name,
    expose,
    exposes: additionalExposes = {},
    shared: additionalShared = {},
    skip: additionalSkip = [],
    ...nativeFederationOptions
  } = options;

  return {
    ...nativeFederationOptions,
    name,
    exposes: { ...additionalExposes, ...atlasExposes(projectRoot, expose) },
    shared: {
      ...shareAll(ANGULAR_SHARED_DEPENDENCY_OPTIONS, {
        projectPath: projectRoot,
        overrides: {
          '@angular/core': {
            ...ANGULAR_SHARED_DEPENDENCY_OPTIONS,
            includeSecondaries: { keepAll: true, skip: [] },
          },
        },
      }),
      ...additionalShared,
    },
    skip: [...new Set([...ANGULAR_FEDERATION_SKIP, ...additionalSkip])],
  };
}

function atlasExposes(
  projectRoot: string,
  expose: AngularProjectExpose | undefined,
): Record<string, string> {
  if (expose === 'host') {
    return {
      './host': workspaceRelativePath(projectRoot, 'src', 'bootstrap.ts'),
    };
  }
  if (expose === 'app') {
    return {
      './entry': workspaceRelativePath(projectRoot, 'src', 'entry.ts'),
      ...Object.fromEntries(
        createAngularWidgetEntries(projectRoot).map((entry) => [
          `./widgets/${entry.name}`,
          workspaceRelativePath(projectRoot, entry.entryPoint),
        ]),
      ),
    };
  }

  return {};
}
