import { createRequire } from 'node:module';
import { join } from 'node:path';
import { workspaceRelativePath } from '../project-paths/project-paths.cjs';
import { createAngularWidgetEntries } from '../widget-entries/widget-entries.cjs';
import type {
  AngularFederationConfigOptions,
  AngularFederationOptions,
  AngularProjectExpose,
  NativeFederationConfigModule,
  ShareAll,
  SharedDependencyOptions,
} from './angular-federation.types.cjs';

const NATIVE_FEDERATION_CONFIG = '@angular-architects/native-federation/config';

const ANGULAR_FEDERATION_SKIP = [
  '@atlas/runtime/react',
  '@atlas/sdk/react',
  'rxjs/ajax',
  'rxjs/fetch',
  'rxjs/testing',
  'rxjs/webSocket',
];

const ANGULAR_SHARED_DEPENDENCY_OPTIONS: SharedDependencyOptions =
  Object.freeze({
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
    NATIVE_FEDERATION_CONFIG,
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

  const sharedAngularPackages = shareAll(ANGULAR_SHARED_DEPENDENCY_OPTIONS, {
    projectPath: projectRoot,
    overrides: {
      '@angular/core': {
        ...ANGULAR_SHARED_DEPENDENCY_OPTIONS,
        includeSecondaries: { keepAll: true, skip: [] },
      },
    },
  });

  return {
    ...nativeFederationOptions,
    name,
    exposes: { ...additionalExposes, ...atlasExposesFor(projectRoot, expose) },
    shared: { ...sharedAngularPackages, ...additionalShared },
    skip: [...new Set([...ANGULAR_FEDERATION_SKIP, ...additionalSkip])],
  };
}

function atlasExposesFor(
  projectRoot: string,
  expose: AngularProjectExpose | undefined,
): Record<string, string> {
  if (expose === 'host') {
    return {
      './host': workspaceRelativePath(projectRoot, 'src', 'bootstrap.ts'),
    };
  }

  if (expose === 'app') {
    const widgetExposes = createAngularWidgetEntries(projectRoot).map(
      (entry) => [
        `./widgets/${entry.name}`,
        workspaceRelativePath(projectRoot, entry.entryPoint),
      ],
    );

    return {
      './entry': workspaceRelativePath(projectRoot, 'src', 'entry.ts'),
      ...Object.fromEntries(widgetExposes),
    };
  }

  return {};
}
