import { angularRemoteName } from "./angular-names.js";

export function angularWorkspace(name: string, host: boolean, devServerPort = defaultDevServerPort(host)): unknown {
  return {
    version: 1,
    projects: {
      [name]: {
        projectType: "application", root: "", sourceRoot: "src",
        architect: {
          build: { builder: "@angular-architects/native-federation:build", options: { target: `${name}:esbuild:production` }, configurations: { development: { target: `${name}:esbuild:development`, dev: true } } },
          serve: { builder: "@angular-architects/native-federation:build", options: { target: `${name}:serve-original:development`, dev: true, port: devServerPort } },
          esbuild: {
            builder: "@angular-devkit/build-angular:application",
            options: { outputPath: `dist/${name}`, index: "src/index.html", browser: "src/main.ts", polyfills: ["zone.js", "es-module-shims"], tsConfig: "tsconfig.app.json", assets: [{ glob: "**/*", input: "public" }, { glob: "**/*", input: "src/assets", output: "assets" }], styles: ["src/styles.css"] },
            configurations: { production: { outputHashing: "all" }, development: { optimization: false, sourceMap: true } }
          },
          "serve-original": {
            builder: "@angular-devkit/build-angular:dev-server",
            options: { port: devServerPort },
            configurations: { production: { buildTarget: `${name}:esbuild:production` }, development: { buildTarget: `${name}:esbuild:development` } },
            defaultConfiguration: "development"
          }
        }
      }
    }
  };
}

function defaultDevServerPort(host: boolean): number {
  return host ? 4200 : 4201;
}

function angularCompilerOptions(): Record<string, unknown> {
  return {
    target: "ES2022",
    module: "ES2022",
    moduleResolution: "bundler",
    strict: true,
    experimentalDecorators: true,
    useDefineForClassFields: false,
    lib: ["ES2022", "DOM"],
    skipLibCheck: true
  };
}

function angularTemplateCompilerOptions(): Record<string, unknown> {
  return { strictTemplates: true, strictInjectionParameters: true };
}

export function angularAppTsconfig(): unknown {
  return {
    extends: "./tsconfig.json",
    compilerOptions: { outDir: "./out-tsc/app" },
    files: ["src/main.ts", "atlas.config.ts"],
    include: ["src/**/*.ts", ".atlas/**/*.ts"]
  };
}

export function angularRootTsconfig(): unknown {
  return {
    compilerOptions: angularCompilerOptions(),
    angularCompilerOptions: angularTemplateCompilerOptions()
  };
}

export function angularFederationConfig(name: string, host: boolean): string {
  return `const { createAngularFederationConfig } = require("@atlas/sdk/federation-config");

module.exports = createAngularFederationConfig({
  projectRoot: __dirname,
  name: "${angularRemoteName(name)}",
  expose: "${host ? "host" : "app"}"
});
`;
}
