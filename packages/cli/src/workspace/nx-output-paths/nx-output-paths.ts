import { resolve } from 'node:path';

export interface NxProjectConfiguration {
  name?: string;
  targets?: Record<string, NxTargetConfiguration>;
}

export interface NxTargetConfiguration {
  defaultConfiguration?: string;
  outputs?: string[];
  executor?: string;
  options?: { outputPath?: NxOutputPath; target?: string };
  configurations?: Record<string, { outputPath?: NxOutputPath }>;
}

export type NxOutputPath = string | { base?: string; browser?: string };

interface NxOutputTarget {
  target: NxTargetConfiguration;
  configuration?: string;
}

const NATIVE_FEDERATION_BUILD_EXECUTOR =
  '@angular-architects/native-federation:build';

export function nxOutputPaths(options: {
  project: NxProjectConfiguration | undefined;
  workspaceRoot: string;
  projectRoot: string;
}): string[] {
  const { project, workspaceRoot, projectRoot } = options;
  const build = project?.targets?.build;

  if (!build) return [];
  const targets = nxOutputTargets(project, build);
  const configuredOutputPaths = targets.flatMap(({ target, configuration }) =>
    configuredNxOutputPaths({ target, configuration, workspaceRoot }),
  );
  const declaredOutputs = targets.flatMap(({ target }) =>
    declaredNxOutputPaths({
      target,
      projectName: project?.name,
      projectRoot,
      workspaceRoot,
    }),
  );

  return [...new Set([...configuredOutputPaths, ...declaredOutputs])];
}

function nxOutputTargets(
  project: NxProjectConfiguration | undefined,
  build: NxTargetConfiguration,
): NxOutputTarget[] {
  const delegated = delegatedNxBuildTarget(project, build);

  return delegated ? [delegated, { target: build }] : [{ target: build }];
}

function delegatedNxBuildTarget(
  project: NxProjectConfiguration | undefined,
  build: NxTargetConfiguration,
): NxOutputTarget | undefined {
  if (build.executor !== NATIVE_FEDERATION_BUILD_EXECUTOR) return undefined;
  const target = build.options?.target;

  if (!target) return undefined;
  const [projectName, targetName, configuration] = target.split(':');

  if (projectName !== project?.name || !targetName) return undefined;
  const delegatedTarget = project.targets?.[targetName];

  return delegatedTarget
    ? { target: delegatedTarget, configuration }
    : undefined;
}

function configuredNxOutputPaths(options: {
  target: NxTargetConfiguration;
  configuration: string | undefined;
  workspaceRoot: string;
}): string[] {
  const { target, configuration, workspaceRoot } = options;
  const configurations = Object.entries(target.configurations ?? {});
  const preferredConfiguration = configuration ?? target.defaultConfiguration;
  const orderedConfigurations = preferredConfiguration
    ? configurations.sort(
        ([left], [right]) =>
          Number(right === preferredConfiguration) -
          Number(left === preferredConfiguration),
      )
    : configurations;

  return [
    ...expandNxOutputPath(target.options?.outputPath, workspaceRoot),
    ...orderedConfigurations.flatMap(([, targetConfiguration]) =>
      expandNxOutputPath(targetConfiguration.outputPath, workspaceRoot),
    ),
  ];
}

function declaredNxOutputPaths(options: {
  target: NxTargetConfiguration;
  projectName: string | undefined;
  projectRoot: string;
  workspaceRoot: string;
}): string[] {
  return (options.target.outputs ?? [])
    .map((output) =>
      interpolateNxOutputTokens(
        output,
        options.projectName,
        options.projectRoot,
      ),
    )
    .filter((output): output is string => Boolean(output))
    .map((output) => resolve(options.workspaceRoot, output));
}

function expandNxOutputPath(
  outputPath: NxOutputPath | undefined,
  workspaceRoot: string,
): string[] {
  if (typeof outputPath === 'string')
    return [resolve(workspaceRoot, outputPath)];

  if (!outputPath?.base) return [];
  const base = resolve(workspaceRoot, outputPath.base);

  return outputPath.browser
    ? [resolve(base, outputPath.browser), base]
    : [base];
}

function interpolateNxOutputTokens(
  output: string,
  projectName: string | undefined,
  projectRoot: string,
): string | undefined {
  if (output.includes('{options.outputPath}')) return undefined;

  return output
    .replace(/^\{workspaceRoot\}\/?/, '')
    .replaceAll('{projectName}', projectName ?? '')
    .replace(/^\{projectRoot\}\/?/, projectRoot ? `${projectRoot}/` : '');
}
