import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as federationConfig from './federation-config.cjs';
import type {
  AngularFederationConfigOptions,
  ShareAll,
} from './federation-config.cjs';

export const {
  createReactAppViteConfig,
  createReactHostViteConfig,
  createReactWidgetEntries,
  FederationConfigError,
} = federationConfig;

export type {
  AngularFederationConfigOptions,
  AngularFederationOptions,
  AngularProjectExpose,
  FederationConfigErrorOptions,
  ReactFederationConfigOptions,
  ReactWidgetEntriesOptions,
  ShareAll,
  SkipEntry,
  GeneratedWidgetEntry,
} from './federation-config.cjs';

export interface AngularV4FederationConfigOptions extends AngularFederationConfigOptions {
  /** Package that exposes the async `config` entry, for example `@angular-architects/native-federation`. */
  readonly nativeFederationPackage: string;
}

interface NativeFederationV4ConfigModule {
  readonly shareAll: ShareAll;
  readonly withNativeFederation: (options: unknown) => unknown;
}

/** Native Federation config for `@angular-architects/native-federation` v21+ (ESM-only `config` entry). */
export async function createAngularV4FederationConfig(
  options: AngularV4FederationConfigOptions,
): Promise<unknown> {
  const { nativeFederationPackage, ...federationOptions } = options;
  const requireFromProject = createRequire(
    join(options.projectRoot, 'package.json'),
  );
  const modulePath = requireFromProject.resolve(
    `${nativeFederationPackage}/config`,
  );
  const { shareAll, withNativeFederation } = (await import(
    pathToFileURL(modulePath).href
  )) as NativeFederationV4ConfigModule;

  return withNativeFederation(
    federationConfig.createAngularFederationOptions(
      federationOptions,
      shareAll,
    ),
  );
}
