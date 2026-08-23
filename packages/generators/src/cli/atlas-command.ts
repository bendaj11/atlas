import type { AtlasPackageManager } from './generator-types.js';

export function atlasCommand(
  packageManager: AtlasPackageManager | undefined,
  command: string,
): string {
  const executor = packageManager === 'pnpm' ? 'pnpm exec' : 'npx --no-install';
  return `${executor} atlas ${command}`;
}
