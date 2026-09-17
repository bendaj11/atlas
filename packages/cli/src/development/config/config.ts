import { join } from 'node:path';
import type { AtlasConfig } from '@atlas/schema';
import {
  readJsonFile,
  readTextFile,
  asRecord,
  isHostConfig,
} from '../../shared/index.js';

export { isHostConfig };

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

export function routePaths(config: AtlasConfig, hostId: string): string[] {
  if (isHostConfig(config)) return [];
  return (
    config.routes
      ?.filter((route) => route.hostId === hostId || route.hostId === '*')
      .map((route) => route.path) ?? []
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
          route.hostId !== '*' && routeMatchesPath(route.path, pathname),
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

export function urlWithPath(hostUrl: string, path: string): string {
  return `${hostUrl.replace(/\/$/, '')}${path}`;
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

export async function readAngularProxyConfigPath(
  projectRoot: string,
  projectName: string,
): Promise<string | undefined> {
  const workspace = await readJsonFile<Record<string, unknown>>(
    join(projectRoot, 'angular.json'),
  );
  const projects = asObject(workspace?.projects);
  const project = asRecord(projects[projectName]) ?? firstObjectValue(projects);
  const targets = asObject(project?.architect ?? project?.targets);

  return (
    readTargetProxyConfig(targets['serve-original']) ??
    readTargetProxyConfig(targets.serve)
  );
}

function routeMatchesPath(path: string, pathname: string): boolean {
  const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');

  return (
    normalizedPath === '/' ||
    pathname === normalizedPath ||
    pathname.startsWith(`${normalizedPath}/`)
  );
}

function readAngularProjectPort(
  workspace: Record<string, unknown> | undefined,
  projectName: string,
): number | undefined {
  const projects = asObject(workspace?.projects);
  const project = asRecord(projects[projectName]) ?? firstObjectValue(projects);

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

function readTargetProxyConfig(target: unknown): string | undefined {
  const proxyConfig = asObject(asObject(target).options).proxyConfig;

  return typeof proxyConfig === 'string' && proxyConfig
    ? proxyConfig
    : undefined;
}

async function readViteDevServerPort(
  projectRoot: string,
): Promise<number | undefined> {
  const source = await readTextFile(join(projectRoot, 'vite.config.ts'));
  if (source === undefined) return undefined;
  const match = /\bserver\s*:\s*\{[^}]*\bport\s*:\s*(\d{1,5})\b/s.exec(source);

  return match?.[1] ? parsePort(match[1]) : undefined;
}

function parsePort(value: string | number): number | undefined {
  const port = Number(value);

  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? port
    : undefined;
}

function firstObjectValue(
  value: Record<string, unknown>,
): Record<string, unknown> | undefined {
  return Object.values(value).find(
    (entry): entry is Record<string, unknown> => asRecord(entry) !== undefined,
  );
}

function asObject(value: unknown): Record<string, unknown> {
  return asRecord(value) ?? {};
}
