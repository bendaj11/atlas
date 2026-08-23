import {
  atlasPackageRange,
  type AngularVersionProfile,
} from './generator-versions.js';
import { atlasCommand } from './atlas-command.js';
import type { AtlasPackageManager } from './generator-types.js';

interface AngularPackageOptions {
  packageName: string;
  projectName: string;
  type: 'host' | 'app';
  profile: AngularVersionProfile;
  packageManager?: AtlasPackageManager;
  routed?: boolean;
}

export function angularPackage(options: AngularPackageOptions): unknown {
  const { packageName, projectName, profile, packageManager } = options;
  const host = options.type === 'host';
  const angular = angularDependencyRange(profile.version);
  const routed = host || (options.routed ?? true);
  return {
    name: packageName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: atlasCommand(packageManager, `dev ${projectName}`),
      'framework:dev': `ng serve ${projectName}`,
      'atlas:config': `atlas compile-config ${projectName}`,
      build: 'ng build',
      'atlas:publish': atlasCommand(packageManager, `publish ${projectName}`),
      ...(host
        ? {
            'atlas:bootstrap': `atlas build-bootstrap ${projectName} --skip-compile`,
          }
        : {}),
    },
    dependencies: {
      '@angular/animations': angular,
      '@angular/common': angular,
      '@angular/compiler': angular,
      '@angular/core': angular,
      '@angular/platform-browser': angular,
      ...(routed ? { '@angular/router': angular } : {}),
      [nativeFederationPackage(profile)]: `^${profile.major}.0.0`,
      ...(usesNativeFederationV4(profile)
        ? { '@softarc/native-federation': '^4.3.2' }
        : {}),
      '@atlas/schema': atlasPackageRange(),
      '@atlas/sdk': atlasPackageRange(),
      ...(host
        ? {
            '@atlas/runtime': atlasPackageRange(),
          }
        : {}),
      'es-module-shims': '^2.3.0',
      rxjs: '^7.8.0',
      tslib: '^2.8.0',
      ...(!profile.zoneless ? { 'zone.js': profile.zone } : {}),
    },
    devDependencies: {
      '@atlas/cli': atlasPackageRange(),
      '@angular-devkit/build-angular': angular,
      '@angular/cli': angular,
      '@angular/compiler-cli': angular,
      ...(host ? { '@types/node': '^22.0.0' } : {}),
      typescript: profile.typescript,
    },
  };
}

function nativeFederationPackage(profile: AngularVersionProfile): string {
  return usesNativeFederationV4(profile)
    ? '@angular-architects/native-federation-v4'
    : '@angular-architects/native-federation';
}

function usesNativeFederationV4(profile: AngularVersionProfile): boolean {
  return profile.major === 20 || profile.major === 21;
}

function angularDependencyRange(version: string): string {
  const exactVersion = version.match(/^[=~^]?(\d+\.\d+\.\d+(?:-[\w.-]+)?)$/);
  return exactVersion ? `^${exactVersion[1]}` : version;
}

export function angularIndex(pageTitle: string, body: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${pageTitle}</title>\n  <base href="/">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`;
}
