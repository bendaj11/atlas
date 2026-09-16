import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import type ts from 'typescript';
import { federationConfigError } from '../federation-config-error/federation-config-error.cjs';

export type TypeScriptModule = typeof ts;

export interface DiscoverRuntimeImportsOptions {
  readonly projectRoot: string;
  readonly entryPoints: readonly string[];
  /** Package names declared by the project; imports of these are reported, everything else is followed locally. */
  readonly declared: Readonly<Record<string, string>>;
  readonly typescript: TypeScriptModule;
}

const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
]);

export function isSourceFile(fileName: string): boolean {
  return SOURCE_EXTENSIONS.has(extname(fileName));
}

export function rootPackageName(specifier: string): string {
  const parts = specifier.split('/');

  return specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : (parts[0] ?? specifier);
}

/** Loads the project's own TypeScript so import discovery matches the compiler the project builds with. */
export function loadProjectTypescript(
  requireFromProject: NodeJS.Require,
): TypeScriptModule {
  try {
    return requireFromProject('typescript') as TypeScriptModule;
  } catch {
    try {
      return require('typescript') as TypeScriptModule;
    } catch (cause) {
      throw federationConfigError(
        'Atlas React federation requires TypeScript to discover shared runtime dependencies.',
        {
          suggestedActions:
            'Add "typescript" to the project devDependencies and reinstall, then rebuild.',
          code: 'ATLAS_FEDERATION_TYPESCRIPT_MISSING',
          cause,
        },
      );
    }
  }
}

/** Walks runtime imports from the entry points through local modules and returns every declared-package specifier. */
export function discoverRuntimePackageImports(
  options: DiscoverRuntimeImportsOptions,
): string[] {
  const { typescript } = options;
  const compilerOptions = readCompilerOptions(options);
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
    for (const specifier of runtimeModuleSpecifiers(typescript, sourceFile)) {
      if (options.declared[rootPackageName(specifier)]) {
        imported.add(specifier);
        continue;
      }
      const localModule = resolveLocalModule({
        typescript,
        specifier,
        containingFile: fileName,
        compilerOptions,
        projectRoot: options.projectRoot,
      });
      if (localModule) pending.push(localModule);
    }
  }

  return [...imported];
}

function readCompilerOptions(
  options: Pick<DiscoverRuntimeImportsOptions, 'projectRoot' | 'typescript'>,
): ts.CompilerOptions {
  const { typescript } = options;
  const configPath = typescript.findConfigFile(
    options.projectRoot,
    typescript.sys.fileExists,
  );
  if (!configPath) {
    return {
      allowJs: true,
      jsx: typescript.JsxEmit.ReactJSX,
      moduleResolution: typescript.ModuleResolutionKind.Bundler,
    };
  }
  const loaded = typescript.readConfigFile(configPath, typescript.sys.readFile);
  if (loaded.error) {
    throw federationConfigError(
      `Atlas could not read ${configPath}: ${typescript.flattenDiagnosticMessageText(loaded.error.messageText, '\n')}`,
      {
        suggestedActions:
          'Fix the reported tsconfig syntax error, then rebuild.',
        code: 'ATLAS_FEDERATION_TSCONFIG_INVALID',
      },
    );
  }

  return typescript.parseJsonConfigFileContent(
    loaded.config,
    typescript.sys,
    resolve(configPath, '..'),
  ).options;
}

function runtimeModuleSpecifiers(
  typescript: TypeScriptModule,
  sourceFile: ts.SourceFile,
): string[] {
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    const specifier = runtimeModuleSpecifier(typescript, node);
    if (specifier !== undefined) specifiers.push(specifier);
    typescript.forEachChild(node, visit);
  };
  visit(sourceFile);

  return specifiers;
}

function runtimeModuleSpecifier(
  typescript: TypeScriptModule,
  node: ts.Node,
): string | undefined {
  if (typescript.isImportDeclaration(node)) {
    return isRuntimeImport(typescript, node) &&
      typescript.isStringLiteral(node.moduleSpecifier)
      ? node.moduleSpecifier.text
      : undefined;
  }
  if (typescript.isExportDeclaration(node)) {
    return !node.isTypeOnly &&
      node.moduleSpecifier &&
      typescript.isStringLiteral(node.moduleSpecifier)
      ? node.moduleSpecifier.text
      : undefined;
  }
  if (typescript.isCallExpression(node)) {
    const argument = node.arguments[0];
    return node.arguments.length === 1 &&
      argument !== undefined &&
      typescript.isStringLiteral(argument) &&
      isModuleCallee(typescript, node.expression)
      ? argument.text
      : undefined;
  }

  return undefined;
}

function isRuntimeImport(
  typescript: TypeScriptModule,
  node: ts.ImportDeclaration,
): boolean {
  const clause = node.importClause;
  if (!clause || clause.isTypeOnly) return false;
  if (clause.name) return true;
  const bindings = clause.namedBindings;
  if (!bindings || typescript.isNamespaceImport(bindings)) return true;

  return bindings.elements.some((element) => !element.isTypeOnly);
}

function isModuleCallee(
  typescript: TypeScriptModule,
  expression: ts.Expression,
): boolean {
  return (
    expression.kind === typescript.SyntaxKind.ImportKeyword ||
    (typescript.isIdentifier(expression) && expression.text === 'require')
  );
}

function resolveLocalModule(options: {
  readonly typescript: TypeScriptModule;
  readonly specifier: string;
  readonly containingFile: string;
  readonly compilerOptions: ts.CompilerOptions;
  readonly projectRoot: string;
}): string | undefined {
  const { typescript } = options;
  const resolution = typescript.resolveModuleName(
    options.specifier,
    options.containingFile,
    options.compilerOptions,
    typescript.sys,
  ).resolvedModule;
  if (!resolution) return undefined;
  const resolvedFile = resolve(resolution.resolvedFileName);
  const sourceRoot = `${resolve(options.projectRoot)}${sep}`;
  if (
    !resolvedFile.startsWith(sourceRoot) ||
    resolvedFile.includes(`${sep}node_modules${sep}`)
  ) {
    return undefined;
  }

  return resolvedFile;
}
