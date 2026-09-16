import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as federationConfig from './federation-config.cjs';
export const { createReactAppViteConfig, createReactHostViteConfig, createReactWidgetEntries, FederationConfigError, } = federationConfig;
/** Native Federation config for `@angular-architects/native-federation` v21+ (ESM-only `config` entry). */
export async function createAngularV4FederationConfig(options) {
    const { nativeFederationPackage, ...federationOptions } = options;
    const requireFromProject = createRequire(join(options.projectRoot, 'package.json'));
    const modulePath = requireFromProject.resolve(`${nativeFederationPackage}/config`);
    const { shareAll, withNativeFederation } = (await import(pathToFileURL(modulePath).href));
    return withNativeFederation(federationConfig.createAngularFederationOptions(federationOptions, shareAll));
}
