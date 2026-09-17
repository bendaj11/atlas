import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type ts from 'typescript';
import { collectRuntimeModuleSpecifiers } from './module-specifiers.cjs';
import {
  readProjectCompilerOptions,
  type TypeScriptModule,
} from './project-typescript.cjs';
import { isSourceFile, extractRootPackageName } from './package-specifiers.cjs';

export interface DiscoverRuntimeImportsOptions {
  readonly projectRoot: string;
  readonly entryPoints: readonly string[];
  /** Package names declared by the project; imports of these are reported, everything else is followed locally. */
  readonly declared: Readonly<Record<string, string>>;
  readonly typescript: TypeScriptModule;
}

interface LocalModuleRequest {
  readonly typescript: TypeScriptModule;
  readonly specifier: string;
  readonly containingFile: string;
  readonly compilerOptions: ts.CompilerOptions;
  readonly projectRoot: string;
}

/** Walks runtime imports from the entry points through local modules and returns every declared-package specifier. */
export function discoverRuntimePackageImports(
  options: DiscoverRuntimeImportsOptions,
): string[] {
  const { typescript, projectRoot, declared } = options;
  const compilerOptions = readProjectCompilerOptions(typescript, projectRoot);

  const pending = [...options.entryPoints];
  const visited = new Set<string>();
  const imported = new Set<string>();

  while (pending.length > 0) {
    const fileName = resolve(pending.pop()!);

    if (visited.has(fileName) || !isSourceFile(fileName)) continue;
    visited.add(fileName);

    if (!existsSync(fileName)) continue;

    const sourceFile = typescript.createSourceFile(
      fileName,
      readFileSync(fileName, 'utf8'),
      typescript.ScriptTarget.Latest,
      true,
    );

    for (const specifier of collectRuntimeModuleSpecifiers(
      typescript,
      sourceFile,
    )) {
      if (declared[extractRootPackageName(specifier)]) {
        imported.add(specifier);
        continue;
      }

      const localModule = resolveLocalModule({
        typescript,
        specifier,
        containingFile: fileName,
        compilerOptions,
        projectRoot,
      });
      if (localModule) pending.push(localModule);
    }
  }

  return [...imported];
}

/** Resolves a relative or path-mapped specifier to a project source file; `undefined` for node_modules or outside the project. */
function resolveLocalModule(request: LocalModuleRequest): string | undefined {
  const { typescript } = request;

  const resolution = typescript.resolveModuleName(
    request.specifier,
    request.containingFile,
    request.compilerOptions,
    typescript.sys,
  ).resolvedModule;

  if (!resolution) return undefined;

  const resolvedFile = resolve(resolution.resolvedFileName);
  const sourceRoot = `${resolve(request.projectRoot)}${sep}`;
  const isProjectSource =
    resolvedFile.startsWith(sourceRoot) &&
    !resolvedFile.includes(`${sep}node_modules${sep}`);

  return isProjectSource ? resolvedFile : undefined;
}
