import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import ts from "typescript";
import type { AtlasProject, AtlasWorkspace } from "./workspace.js";

export async function compileAtlasConfig(workspace: AtlasWorkspace, project: AtlasProject): Promise<void> {
  await compileAtlasConfigFile(project.root);
  if (workspace.kind === "nx" && !await compiledAtlasConfigExists(project.root)) {
    throw new Error(`Atlas config compiler did not emit ${join(project.root, ".atlas", "atlas.config.js")}.`);
  }
}

export async function compileAtlasConfigFile(projectRoot: string): Promise<void> {
  const configPath = findCompilerConfig(projectRoot);
  const raw = ts.readConfigFile(configPath, ts.sys.readFile);
  if (raw.error) throw new Error(formatDiagnostics([raw.error], projectRoot));

  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, projectRoot);
  const atlasConfigPath = join(projectRoot, "atlas.config.ts");
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    composite: false,
    incremental: false,
    allowImportingTsExtensions: false,
    module: ts.ModuleKind.Node16,
    moduleResolution: ts.ModuleResolutionKind.Node16,
    outDir: join(projectRoot, ".atlas"),
    rootDir: projectRoot
  };
  await mkdir(options.outDir!, { recursive: true });

  const program = ts.createProgram([atlasConfigPath], options);
  const emitResult = program.emit();
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program), ...emitResult.diagnostics];
  const errors = diagnostics.filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0 || emitResult.emitSkipped) throw new Error(formatDiagnostics(errors.length > 0 ? errors : diagnostics, projectRoot));
}

function findCompilerConfig(projectRoot: string): string {
  const config = ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.app.json")
    ?? ts.findConfigFile(projectRoot, ts.sys.fileExists, "tsconfig.json");
  if (!config) throw new Error(`Could not find tsconfig.app.json or tsconfig.json in ${projectRoot}.`);
  return config;
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[], projectRoot: string): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => projectRoot,
    getNewLine: () => "\n"
  });
}

async function compiledAtlasConfigExists(projectRoot: string): Promise<boolean> {
  for (const candidate of [
    join(projectRoot, ".atlas", "atlas.config.js"),
    join(projectRoot, "dist", "atlas.config.js"),
    join(projectRoot, "atlas.config.js")
  ]) {
    try {
      await access(candidate);
      return true;
    } catch { /* Try next compiler output location. */ }
  }
  return false;
}
