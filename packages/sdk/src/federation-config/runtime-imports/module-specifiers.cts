import type ts from 'typescript';
import type { TypeScriptModule } from './project-typescript.cjs';

/** Every module specifier a file loads at runtime: value imports, re-exports, `import()` and `require()` literals. */
export function runtimeModuleSpecifiers(
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
