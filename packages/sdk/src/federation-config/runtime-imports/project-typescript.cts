import { resolve } from 'node:path';
import type ts from 'typescript';
import { federationConfigError } from '../federation-config-error/federation-config-error.cjs';

export type TypeScriptModule = typeof ts;

/** Loads the project's own TypeScript so import discovery matches the compiler the project builds with. */
export function loadProjectTypescript(
  requireFromProject: NodeJS.Require,
): TypeScriptModule {
  try {
    return requireFromProject('typescript') as TypeScriptModule;
  } catch {
    return loadBundledTypescript();
  }
}

/** Compiler options of the project tsconfig; a bundler-style default when the project has none. */
export function readProjectCompilerOptions(
  typescript: TypeScriptModule,
  projectRoot: string,
): ts.CompilerOptions {
  const configPath = typescript.findConfigFile(
    projectRoot,
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
    const detail = typescript.flattenDiagnosticMessageText(
      loaded.error.messageText,
      '\n',
    );

    throw federationConfigError(
      `Atlas could not read ${configPath}: ${detail}`,
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

function loadBundledTypescript(): TypeScriptModule {
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
