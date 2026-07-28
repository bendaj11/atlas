import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AtlasConfig, AtlasHostConfig } from '@atlas/schema';

export function isHostConfig(config: AtlasConfig): config is AtlasHostConfig {
  if (config.type) return config.type === 'host';
  return (
    'allowCustomOverrides' in config ||
    'resourcesTimeoutMs' in config ||
    'resourcesRetryCount' in config
  );
}

export function configuredHostIds(config: AtlasConfig): string[] {
  if (isHostConfig(config)) return [];
  return [
    ...new Set([
      ...(config.routes ?? []).map((route) => route.hostId),
      ...(config.slots ?? []).map((slot) => slot.hostId),
    ]),
  ].filter((hostId) => hostId !== '*');
}

export function supportsAnyHost(config: AtlasConfig): boolean {
  if (isHostConfig(config)) return false;
  return [...(config.routes ?? []), ...(config.slots ?? [])].some(
    (placement) => placement.hostId === '*',
  );
}

export function routeBasePaths(config: AtlasConfig, hostId: string): string[] {
  if (isHostConfig(config)) return [];
  return (
    config.routes
      ?.filter((route) => route.hostId === hostId || route.hostId === '*')
      .map((route) => route.basePath) ?? []
  );
}

export function hostIdFromRoute(
  config: AtlasConfig,
  hostUrl: string,
): string | undefined {
  if (isHostConfig(config)) return undefined;
  const pathname = new URL(hostUrl).pathname;
  const matchingHostIds = new Set(
    config.routes
      ?.filter(
        (route) =>
          route.hostId !== '*' && routeMatchesPath(route.basePath, pathname),
      )
      .map((route) => route.hostId),
  );
  return matchingHostIds.size === 1
    ? matchingHostIds.values().next().value
    : undefined;
}

export function isBaseHostUrl(value: string): boolean {
  const url = new URL(value);
  return url.pathname === '/' && !url.search && !url.hash;
}

export function urlWithBasePath(hostUrl: string, basePath: string): string {
  return `${hostUrl.replace(/\/$/, '')}${basePath}`;
}

export async function readConfiguredDevServerPort(
  projectRoot: string,
  projectName: string,
): Promise<number | undefined> {
  const angularWorkspace = await readJsonFile<Record<string, unknown>>(
    join(projectRoot, 'angular.json'),
  );
  const angularPort = readAngularProjectPort(angularWorkspace, projectName);
  if (angularPort !== undefined) return angularPort;

  const nxProject = await readJsonFile<Record<string, unknown>>(
    join(projectRoot, 'project.json'),
  );
  const nxPort = readPortFromTargets(asObject(nxProject?.targets));
  if (nxPort !== undefined) return nxPort;

  return await readViteDevServerPort(projectRoot);
}

function routeMatchesPath(basePath: string, pathname: string): boolean {
  const normalizedBasePath =
    basePath === '/' ? '/' : basePath.replace(/\/+$/, '');
  return (
    normalizedBasePath === '/' ||
    pathname === normalizedBasePath ||
    pathname.startsWith(`${normalizedBasePath}/`)
  );
}

function readAngularProjectPort(
  workspace: Record<string, unknown> | undefined,
  projectName: string,
): number | undefined {
  const projects = asObject(workspace?.projects);
  const project =
    objectValue(projects[projectName]) ?? firstObjectValue(projects);
  return readPortFromTargets(asObject(project?.architect ?? project?.targets));
}

function readPortFromTargets(
  targets: Record<string, unknown>,
): number | undefined {
  return (
    readTargetPort(targets.serve) ?? readTargetPort(targets['serve-original'])
  );
}

function readTargetPort(target: unknown): number | undefined {
  const port = asObject(asObject(target).options).port;
  return typeof port === 'number' ? parsePort(port) : undefined;
}

async function readViteDevServerPort(
  projectRoot: string,
): Promise<number | undefined> {
  try {
    const source = await readFile(join(projectRoot, 'vite.config.ts'), 'utf8');
    const match = /\bserver\s*:\s*\{[^}]*\bport\s*:\s*(\d{1,5})\b/s.exec(
      source,
    );
    return match?.[1] ? parsePort(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

function parsePort(value: string | number): number | undefined {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? port
    : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstObjectValue(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return Object.values(value).find(
    (entry): entry is Record<string, unknown> =>
      objectValue(entry) !== undefined,
  );
}

async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
