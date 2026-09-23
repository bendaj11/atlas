import {
  selectNativeFederationPackage,
  usesNativeFederationV4Package,
} from '../federation/angular-federation.js';
import type { PackageManifest } from '../../shared/types/generated-documents.js';
import type { AtlasProjectType } from '../../shared/types/generator-types.js';
import {
  extractExactSemver,
  getAtlasPackageRange,
} from '../../shared/versions/generator-versions.js';
import type { AngularVersionProfile } from '../../shared/versions/generator-versions.types.js';

interface AngularPackageManifestOptions {
  packageName: string;
  projectName: string;
  type: AtlasProjectType;
  profile: AngularVersionProfile;
  routed?: boolean;
}

export function buildAngularPackageManifest(
  options: AngularPackageManifestOptions,
): PackageManifest {
  const { packageName, projectName, profile } = options;
  const host = options.type === 'host';
  const angularRange = convertAngularVersionToRange(profile.version);
  const routed = host || (options.routed ?? true);

  return {
    name: packageName,
    version: '0.1.0',
    private: true,
    atlas: {
      previews: [],
    },
    scripts: {
      dev: `atlas dev ${projectName}`,
      'framework:dev': `ng serve ${projectName}`,
      'atlas:config': `atlas compile-config ${projectName}`,
      build: 'ng build',
      'atlas:publish': `atlas publish ${projectName}`,
      ...(host
        ? {
            'atlas:bootstrap': `atlas bootstrap ${projectName} --skip-compile`,
          }
        : {}),
    },
    dependencies: {
      '@angular/animations': angularRange,
      '@angular/common': angularRange,
      '@angular/compiler': angularRange,
      '@angular/core': angularRange,
      '@angular/platform-browser': angularRange,
      ...(routed ? { '@angular/router': angularRange } : {}),
      [selectNativeFederationPackage(profile)]: `^${profile.major}.0.0`,
      ...(usesNativeFederationV4Package(profile)
        ? { '@softarc/native-federation': '^4.3.2' }
        : {}),
      '@atlas/schema': getAtlasPackageRange(),
      '@atlas/sdk': getAtlasPackageRange(),
      ...(host
        ? {
            '@atlas/runtime': getAtlasPackageRange(),
          }
        : {}),
      'es-module-shims': '^2.3.0',
      rxjs: '^7.8.0',
      tslib: '^2.8.0',
      ...(!profile.zoneless ? { 'zone.js': profile.zone } : {}),
    },
    devDependencies: {
      '@atlas/cli': getAtlasPackageRange(),
      '@angular-devkit/build-angular': angularRange,
      '@angular/cli': angularRange,
      '@angular/compiler-cli': angularRange,
      ...(host ? { '@types/node': '^22.0.0' } : {}),
      typescript: profile.typescript,
    },
  };
}

export function renderAngularIndexHtml(options: {
  pageTitle: string;
  body: string;
}): string {
  const { pageTitle, body } = options;

  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${pageTitle}</title>\n  <base href="/">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`;
}

function convertAngularVersionToRange(version: string): string {
  const exactVersion = extractExactSemver(version);

  return exactVersion ? `^${exactVersion}` : version;
}
