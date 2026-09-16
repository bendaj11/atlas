import type { AtlasProjectType } from '../types/generator-types.js';

export const DEFAULT_HOST_BOOTSTRAP_PORT = 4200;
export const DEFAULT_HOST_CLIENT_PORT = 4300;
export const DEFAULT_APP_DEV_PORT = 4201;

export function defaultDevServerPort(type: AtlasProjectType): number {
  return type === 'host' ? DEFAULT_HOST_BOOTSTRAP_PORT : DEFAULT_APP_DEV_PORT;
}

export function hostClientPort(bootstrapPort: number): number {
  return bootstrapPort === DEFAULT_HOST_CLIENT_PORT
    ? DEFAULT_HOST_BOOTSTRAP_PORT
    : DEFAULT_HOST_CLIENT_PORT;
}
