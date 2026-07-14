import { atlasPackageRange } from "./generator-versions.js";
import type { AtlasGeneratedFile } from "./generator-types.js";
import { json } from "./common-generator.js";

export function generateHostServerFiles(projectName: string, hostId: string): AtlasGeneratedFile[] {
  return [
    { path: "package.json", contents: json(hostServerPackage(projectName)) },
    { path: "main.mts", contents: hostServerMain(hostId) },
    { path: "tsconfig.json", contents: json(hostServerTsconfig()) }
  ];
}

function hostServerPackage(projectName: string): unknown {
  return {
    name: `${projectName}-server`,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      build: "tsc -p tsconfig.json",
      start: "node dist/main.mjs"
    },
    dependencies: {
      "@atlas/host-server": atlasPackageRange()
    },
    devDependencies: {
      "@types/node": "^22.0.0",
      typescript: "~5.9.0"
    }
  };
}

function hostServerMain(hostId: string): string {
  return `import { runAtlasHostServer } from "@atlas/host-server";\n\nawait runAtlasHostServer({ hostId: "${hostId}" });\n`;
}

function hostServerTsconfig(): unknown {
  return {
    compilerOptions: {
      target: "ES2022",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      rootDir: ".",
      outDir: "dist",
      strict: true,
      skipLibCheck: true,
      types: ["node"]
    },
    include: ["main.mts"]
  };
}
