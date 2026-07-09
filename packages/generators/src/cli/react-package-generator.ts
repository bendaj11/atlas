import { atlasPackageRange, type ReactVersionProfile } from "./generator-versions.js";

const REACT_COMPILER_VERSION = "1.0.0";

interface ReactPackageOptions {
  packageName: string;
  projectName: string;
  host: boolean;
  profile: ReactVersionProfile;
  routed?: boolean;
}

export function reactPackage(options: ReactPackageOptions): unknown {
  const { packageName, projectName, host, profile } = options;
  const routed = host || (options.routed ?? true);
  return {
    name: packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: host ? `atlas runtime-config ${projectName} && vite --host 0.0.0.0` : "vite --host 0.0.0.0",
      "atlas:config": `atlas compile-config ${projectName}`,
      build: host ? `atlas runtime-config ${projectName} && tsc -b && vite build` : `atlas compile-config ${projectName} && tsc -b && vite build`,
      ...(host ? {} : { "atlas:build": `atlas build ${projectName}` })
    },
    dependencies: {
      "@atlas/schema": atlasPackageRange(),
      "@atlas/sdk": atlasPackageRange(),
      ...(host ? { "@atlas/runtime": atlasPackageRange() } : {}),
      "@softarc/native-federation-runtime": "^3.5.5",
      "es-module-shims": "^2.7.0",
      react: profile.version,
      "react-dom": profile.version,
      ...(routed ? { "react-router-dom": profile.routerVersion } : {}),
      ...(profile.major < 19 ? { "react-compiler-runtime": REACT_COMPILER_VERSION } : {})
    },
    devDependencies: {
      "@types/node": "^22.0.0",
      "@types/react": `^${profile.major}.0.0`,
      "@types/react-dom": `^${profile.major}.0.0`,
      "@vitejs/plugin-react": "^5.0.4",
      "babel-plugin-react-compiler": REACT_COMPILER_VERSION,
      typescript: "~5.9.0",
      vite: "^7.3.6"
    }
  };
}

export function reactIndex(pageTitle: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle}</title>
    <script type="esms-options">{ "shimMode": true, "mapOverrides": true }</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}
