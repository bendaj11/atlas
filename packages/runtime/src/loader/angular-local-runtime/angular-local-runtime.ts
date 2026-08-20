import type { AtlasManifest } from '@atlas/schema';

type AngularLocalManifest = Partial<
  Pick<AtlasManifest, 'channel' | 'framework'>
>;

export function prepareAngularLocalRuntime(
  manifest: AngularLocalManifest,
  environment: object = globalThis,
): void {
  if (manifest.channel !== 'local' || manifest.framework !== 'angular') return;
  if (Reflect.has(environment, 'ngDevMode')) return;

  Reflect.set(environment, 'ngDevMode', false);
}
