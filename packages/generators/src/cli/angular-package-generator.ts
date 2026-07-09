import { atlasPackageRange, type AngularVersionProfile } from "./generator-versions.js";

interface AngularPackageOptions {
  packageName: string;
  projectName: string;
  host: boolean;
  profile: AngularVersionProfile;
  routed?: boolean;
}

export function angularPackage(options: AngularPackageOptions): unknown {
  const { packageName, projectName, host, profile } = options;
  const angular = profile.version;
  const routed = host || (options.routed ?? true);
  return {
    name: packageName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: host ? `atlas runtime-config ${projectName} && ng serve ${projectName}` : `ng serve ${projectName}`,
      "atlas:config": `atlas compile-config ${projectName}`,
      build: host ? `atlas runtime-config ${projectName} && ng build` : `atlas compile-config ${projectName} && ng build`,
      ...(host ? {} : { "atlas:build": `atlas build ${projectName}` })
    },
    dependencies: {
      "@angular/animations": angular,
      "@angular/common": angular,
      "@angular/compiler": angular,
      "@angular/core": angular,
      "@angular/platform-browser": angular,
      ...(routed ? { "@angular/router": angular } : {}),
      "@angular-architects/native-federation": `^${profile.major}.0.0`,
      "@atlas/schema": atlasPackageRange(),
      "@atlas/sdk": atlasPackageRange(),
      ...(host ? { "@atlas/runtime": atlasPackageRange() } : {}),
      "es-module-shims": "^2.7.0",
      rxjs: "^7.8.0",
      tslib: "^2.8.0",
      "zone.js": profile.zone
    },
    devDependencies: {
      "@angular-devkit/build-angular": angular,
      "@angular/cli": angular,
      "@angular/compiler-cli": angular,
      typescript: profile.typescript
    }
  };
}

export function angularIndex(pageTitle: string, body: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>${pageTitle}</title>\n  <base href="/">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n  ${body}\n</body>\n</html>\n`;
}
