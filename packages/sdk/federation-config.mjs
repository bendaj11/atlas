import federationConfigModule from './federation-config.cjs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const federationConfig = federationConfigModule;
export const { createReactAppViteConfig, createReactHostViteConfig, createReactWidgetEntries, } = federationConfig;
export async function createAngularV4FederationConfig(options) {
    const requireFromProject = createRequire(join(options.projectRoot, 'package.json'));
    const modulePath = requireFromProject.resolve(`${options.nativeFederationPackage}/config`);
    const { shareAll, withNativeFederation } = await import(pathToFileURL(modulePath).href);
    return withNativeFederation(federationConfig.createAngularFederationOptions(options, shareAll));
}
