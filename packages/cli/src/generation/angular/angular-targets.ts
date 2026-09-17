import { recordOrEmpty } from '../../shared/index.js';
import {
  getDefaultDevServerPort,
  deriveHostClientPortFromBootstrapPort,
} from '@atlas/generators';
import type { AtlasProjectType } from '../../workspace/index.js';

export type AngularRunnerKey = 'builder' | 'executor';

const ES_MODULE_SHIMS_POLYFILL = 'es-module-shims';
const DEFAULT_NATIVE_FEDERATION_BUILDER =
  '@angular-architects/native-federation:build';
const NATIVE_FEDERATION_BUILDERS = new Set([
  DEFAULT_NATIVE_FEDERATION_BUILDER,
  '@angular-architects/native-federation-v4:build',
]);
const ANGULAR_BUILD_NOTIFICATIONS_ENDPOINT =
  '/@angular-architects/native-federation:build-notifications';

export function ensureAngularNativeFederationTargets({
  targets,
  projectName,
  type,
  runnerKey,
  devServerPort = getDefaultDevServerPort(type),
  nativeFederationBuilder = DEFAULT_NATIVE_FEDERATION_BUILDER,
}: {
  targets: Record<string, unknown>;
  projectName: string;
  type: AtlasProjectType;
  runnerKey: AngularRunnerKey;
  devServerPort?: number;
  nativeFederationBuilder?: string;
}): void {
  const builder =
    findNativeFederationBuilder({ value: targets.build, runnerKey }) ??
    nativeFederationBuilder;

  if (
    targets.build &&
    !isNativeFederationTarget({ value: targets.build, runnerKey })
  )
    targets.esbuild ??= targets.build;

  if (targets.esbuild) {
    ensureAngularFederationPolyfills(targets.esbuild);
    targets.build = {
      [runnerKey]: builder,
      options: { target: `${projectName}:esbuild:production` },
      configurations: {
        development: {
          target: `${projectName}:esbuild:development`,
          dev: true,
        },
      },
    };
  }

  if (
    targets.serve &&
    !isNativeFederationTarget({ value: targets.serve, runnerKey })
  )
    targets['serve-original'] ??= targets.serve;

  if (targets['serve-original']) {
    retargetAngularServeBuild({
      target: targets['serve-original'],
      projectName,
    });

    if (type === 'host')
      setAngularDevServerPort({
        target: targets['serve-original'],
        port: deriveHostClientPortFromBootstrapPort(devServerPort),
      });

    targets.serve = {
      [runnerKey]: builder,
      options: {
        target: `${projectName}:serve-original:development`,
        dev: true,
        port: devServerPort,
      },
    };
    enableAngularBuildNotifications(targets.serve);
  }
}

export function configureAngularDevelopmentTargets({
  project,
  targetsKey,
  runnerKey,
}: {
  project: Record<string, unknown>;
  targetsKey: 'architect' | 'targets';
  runnerKey: AngularRunnerKey;
}): boolean {
  const targets = recordOrEmpty(project[targetsKey]);
  const serve = recordOrEmpty(targets.serve);

  if (!isNativeFederationTarget({ value: serve, runnerKey })) return false;

  const options = recordOrEmpty(serve.options);

  configureAngularBuildNotifications(options);
  serve.options = options;
  targets.serve = serve;
  project[targetsKey] = targets;

  return true;
}

function setAngularDevServerPort({
  target,
  port,
}: {
  target: unknown;
  port: number;
}): void {
  const targetObject = recordOrEmpty(target);
  const options = recordOrEmpty(targetObject.options);
  options.port = port;
  targetObject.options = options;
}

function enableAngularBuildNotifications(target: unknown): void {
  const targetObject = recordOrEmpty(target);
  const options = recordOrEmpty(targetObject.options);

  configureAngularBuildNotifications(options);
  targetObject.options = options;
}

function configureAngularBuildNotifications(
  options: Record<string, unknown>,
): void {
  if (options.buildNotifications === undefined) {
    options.buildNotifications = {
      enable: true,
      endpoint: ANGULAR_BUILD_NOTIFICATIONS_ENDPOINT,
    };

    return;
  }

  const notifications = recordOrEmpty(options.buildNotifications);

  if (notifications.enable === true && notifications.endpoint === undefined)
    notifications.endpoint = ANGULAR_BUILD_NOTIFICATIONS_ENDPOINT;

  options.buildNotifications = notifications;
}

function ensureAngularFederationPolyfills(target: unknown): void {
  const targetObject = recordOrEmpty(target);
  const options = recordOrEmpty(targetObject.options);
  options.polyfills = addUniquePolyfill({
    value: options.polyfills,
    polyfill: ES_MODULE_SHIMS_POLYFILL,
  });
  targetObject.options = options;
}

function addUniquePolyfill({
  value,
  polyfill,
}: {
  value: unknown;
  polyfill: string;
}): string[] {
  if (typeof value === 'string' && value)
    return value === polyfill ? [value] : [value, polyfill];

  if (Array.isArray(value)) {
    const polyfills = value.filter(
      (item): item is string => typeof item === 'string',
    );

    return polyfills.includes(polyfill) ? polyfills : [...polyfills, polyfill];
  }

  return [polyfill];
}

function retargetAngularServeBuild({
  target,
  projectName,
}: {
  target: unknown;
  projectName: string;
}): void {
  const serveTarget = recordOrEmpty(target);

  retargetAngularBuildReference({
    options: recordOrEmpty(serveTarget.options),
    projectName,
  });

  for (const configuration of Object.values(
    recordOrEmpty(serveTarget.configurations),
  ))
    retargetAngularBuildReference({
      options: recordOrEmpty(configuration),
      projectName,
    });
}

function retargetAngularBuildReference({
  options,
  projectName,
}: {
  options: Record<string, unknown>;
  projectName: string;
}): void {
  for (const key of ['buildTarget', 'browserTarget']) {
    const value = options[key];

    if (typeof value === 'string')
      options[key] = retargetAngularBuildTarget({ value, projectName });
  }
}

function retargetAngularBuildTarget({
  value,
  projectName,
}: {
  value: string;
  projectName: string;
}): string {
  const [targetProject, targetName, ...rest] = value.split(':');

  if (targetProject !== projectName || targetName !== 'build') return value;

  return [targetProject, 'esbuild', ...rest].join(':');
}

function isNativeFederationTarget({
  value,
  runnerKey,
}: {
  value: unknown;
  runnerKey: AngularRunnerKey;
}): boolean {
  return findNativeFederationBuilder({ value, runnerKey }) !== undefined;
}

function findNativeFederationBuilder({
  value,
  runnerKey,
}: {
  value: unknown;
  runnerKey: AngularRunnerKey;
}): string | undefined {
  const builder = recordOrEmpty(value)[runnerKey];

  return typeof builder === 'string' && NATIVE_FEDERATION_BUILDERS.has(builder)
    ? builder
    : undefined;
}
