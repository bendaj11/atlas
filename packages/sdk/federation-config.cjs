"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAngularFederationConfig = createAngularFederationConfig;
exports.createAngularFederationOptions = createAngularFederationOptions;
exports.createReactAppViteConfig = createReactAppViteConfig;
exports.createReactHostViteConfig = createReactHostViteConfig;
exports.createReactWidgetEntries = createReactWidgetEntries;
const { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, } = require('node:fs');
const { createRequire } = require('node:module');
const { extname, join, relative, resolve, sep } = require('node:path');
const { initSync: initializeCommonJsLexer, parse: parseCommonJs, } = require('cjs-module-lexer');
initializeCommonJsLexer();
function sourcePath(projectRoot, path) {
    const pathFromWorkspace = relative(process.cwd(), join(projectRoot, 'src', path)).replaceAll('\\', '/');
    return pathFromWorkspace.startsWith('.')
        ? pathFromWorkspace
        : `./${pathFromWorkspace}`;
}
function projectPath(projectRoot, path) {
    const pathFromWorkspace = relative(process.cwd(), join(projectRoot, path)).replaceAll('\\', '/');
    return pathFromWorkspace.startsWith('.')
        ? pathFromWorkspace
        : `./${pathFromWorkspace}`;
}
function reactBootstrapPath(projectRoot, legacyEntry) {
    const bootstrap = resolve(projectRoot, 'src/bootstrap.tsx');
    return existsSync(bootstrap)
        ? bootstrap
        : resolve(projectRoot, 'src', legacyEntry);
}
function widgetNames(projectRoot) {
    const widgetsRoot = join(projectRoot, 'src/exported-widgets');
    return existsSync(widgetsRoot)
        ? readdirSync(widgetsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
        : [];
}
function writeWidgetEntry(projectRoot, name, extension, contents) {
    const generatedDirectory = join(projectRoot, '.atlas/widgets');
    mkdirSync(generatedDirectory, { recursive: true });
    const relativeEntryPoint = `.atlas/widgets/${name}.${extension}`;
    writeFileSync(join(projectRoot, relativeEntryPoint), contents);
    return relativeEntryPoint;
}
function createAngularWidgetEntries(projectRoot) {
    return widgetNames(projectRoot).map((name) => ({
        name,
        entryPoint: writeWidgetEntry(projectRoot, name, 'ts', `import "zone.js";
import { createExportedWidget } from "@atlas/sdk/angular";
import Widget from ${JSON.stringify(`../../src/exported-widgets/${name}/index`)};
${angularWidgetConfigImport(projectRoot, name)}

export default createExportedWidget(Widget${angularWidgetConfigArgument(projectRoot, name)});
`),
    }));
}
function angularWidgetConfigPath(projectRoot, name) {
    return join(projectRoot, 'src', 'exported-widgets', name, 'widget.config.ts');
}
function angularWidgetConfigImport(projectRoot, name) {
    return existsSync(angularWidgetConfigPath(projectRoot, name))
        ? `import { widgetConfig } from ${JSON.stringify(`../../src/exported-widgets/${name}/widget.config`)};`
        : '';
}
function angularWidgetConfigArgument(projectRoot, name) {
    return existsSync(angularWidgetConfigPath(projectRoot, name))
        ? ', widgetConfig'
        : '';
}
function createReactWidgetEntries(options) {
    return widgetNames(options.projectRoot).map((name) => ({
        name,
        entryPoint: writeWidgetEntry(options.projectRoot, name, 'tsx', reactWidgetEntry(name, options.reactMajor)),
    }));
}
function reactRemoteName(name) {
    return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}
const BUILD_NOTIFICATIONS_ENDPOINT = '/@atlas/federation-build-notifications';
function federationMetadataPlugin(options) {
    return {
        name: options.pluginName,
        configureServer(server) {
            server.middlewares.use('/remoteEntry.json', (_request, response) => {
                response.setHeader('content-type', 'application/json');
                response.setHeader('access-control-allow-origin', '*');
                response.end(JSON.stringify({
                    ...options.metadata,
                    buildNotificationsEndpoint: BUILD_NOTIFICATIONS_ENDPOINT,
                    exposes: options.devExposes,
                    shared: options.devShared || options.metadata.shared,
                }));
            });
        },
        writeBundle() {
            mkdirSync(resolve(options.projectRoot, 'dist'), { recursive: true });
            writeFileSync(resolve(options.projectRoot, 'dist/remoteEntry.json'), JSON.stringify(options.metadata, null, 2));
        },
    };
}
function federationBuildNotificationsPlugin(projectRoot) {
    const clients = new Set();
    const sourceRoot = `${resolve(projectRoot, 'src').replaceAll('\\', '/')}/`;
    return {
        name: 'atlas-federation-build-notifications',
        apply: 'serve',
        configureServer(server) {
            server.middlewares.use(BUILD_NOTIFICATIONS_ENDPOINT, (_request, response) => {
                response.writeHead(200, {
                    'access-control-allow-origin': '*',
                    'cache-control': 'no-cache',
                    connection: 'keep-alive',
                    'content-type': 'text/event-stream',
                });
                response.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
                clients.add(response);
                response.once('close', () => clients.delete(response));
            });
        },
        handleHotUpdate({ file }) {
            if (!file.replaceAll('\\', '/').startsWith(sourceRoot))
                return;
            const event = `data: ${JSON.stringify({ type: 'federation-rebuild-complete' })}\n\n`;
            for (const response of clients)
                response.write(event);
        },
    };
}
const REACT_FRAMEWORK_SHARED_SPECIFIERS = {
    react: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    'react-dom': ['react-dom', 'react-dom/client'],
    '@atlas/sdk': [
        '@atlas/sdk',
        '@atlas/sdk/federation',
        '@atlas/sdk/host',
        '@atlas/sdk/lifecycle',
        '@atlas/sdk/navigation',
        '@atlas/sdk/react',
    ],
};
const ANGULAR_FEDERATION_SKIP = [
    '@atlas/runtime/react',
    '@atlas/sdk/react',
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
];
const ANGULAR_SHARED_DEPENDENCY_OPTIONS = Object.freeze({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
});
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
function reactSharedDependencies(options, exposedEntryPoints) {
    const packagePath = join(options.projectRoot, 'package.json');
    const packageJson = existsSync(packagePath)
        ? JSON.parse(readFileSync(packagePath, 'utf8'))
        : {};
    const declared = {
        ...(packageJson.dependencies || {}),
        ...(packageJson.peerDependencies || {}),
    };
    const requireFromProject = createRequire(packagePath);
    const typescript = loadProjectTypescript(requireFromProject);
    const importedSpecifiers = discoverRuntimePackageImports({
        projectRoot: options.projectRoot,
        entryPoints: exposedEntryPoints,
        declared,
        typescript,
    });
    const frameworkSpecifiers = Object.entries(REACT_FRAMEWORK_SHARED_SPECIFIERS).flatMap(([packageName, specifiers]) => declared[packageName] ? specifiers : []);
    const specifiers = [
        ...new Set([...frameworkSpecifiers, ...importedSpecifiers]),
    ].sort();
    return specifiers.flatMap((specifier) => {
        const packageName = rootPackageName(specifier);
        const entryPoint = resolveSharedEntry(requireFromProject, specifier);
        if (!isSourceFile(entryPoint))
            return [];
        const packageInfo = readPackageInfo(requireFromProject, packageName, specifier);
        const entryName = `shared/${sharedFileName(specifier)}`;
        const commonJs = isCommonJsEntry(entryPoint);
        return [
            {
                specifier,
                entryName,
                entryPoint,
                commonJs,
                namedExports: commonJs ? commonJsNamedExports(entryPoint) : [],
                hasDefaultExport: commonJs || hasEsmDefaultExport(typescript, entryPoint),
                metadata: {
                    packageName: specifier,
                    outFileName: `${entryName}.js`,
                    requiredVersion: declared[packageName] || packageInfo.version,
                    singleton: true,
                    strictVersion: true,
                    version: packageInfo.version,
                },
                devMetadata: {
                    packageName: specifier,
                    outFileName: `@id/${specifier}`,
                    requiredVersion: declared[packageName] || packageInfo.version,
                    singleton: true,
                    strictVersion: true,
                    version: packageInfo.version,
                },
            },
        ];
    });
}
function resolveSharedEntry(requireFromProject, specifier) {
    try {
        return requireFromProject.resolve(specifier);
    }
    catch {
        throw new Error(`Atlas could not resolve shared dependency entry "${specifier}".`);
    }
}
function loadProjectTypescript(requireFromProject) {
    try {
        return requireFromProject('typescript');
    }
    catch {
        try {
            return require('typescript');
        }
        catch {
            throw new Error('Atlas React federation requires TypeScript to discover shared runtime dependencies.');
        }
    }
}
function discoverRuntimePackageImports(options) {
    const { typescript } = options;
    const compilerOptions = readCompilerOptions(options);
    const pending = [...options.entryPoints];
    const visited = new Set();
    const imported = new Set();
    while (pending.length > 0) {
        const pendingFile = pending.pop();
        if (!pendingFile)
            continue;
        const fileName = resolve(pendingFile);
        if (visited.has(fileName) || !isSourceFile(fileName))
            continue;
        visited.add(fileName);
        if (!existsSync(fileName))
            continue;
        const sourceFile = typescript.createSourceFile(fileName, readFileSync(fileName, 'utf8'), typescript.ScriptTarget.Latest, true);
        for (const specifier of runtimeModuleSpecifiers(typescript, sourceFile)) {
            const packageName = rootPackageName(specifier);
            if (options.declared[packageName]) {
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
            if (localModule)
                pending.push(localModule);
        }
    }
    return [...imported];
}
function readCompilerOptions(options) {
    const { typescript } = options;
    const configPath = typescript.findConfigFile(options.projectRoot, typescript.sys.fileExists);
    if (!configPath) {
        return {
            allowJs: true,
            jsx: typescript.JsxEmit.ReactJSX,
            moduleResolution: typescript.ModuleResolutionKind.Bundler,
        };
    }
    const loaded = typescript.readConfigFile(configPath, typescript.sys.readFile);
    if (loaded.error) {
        throw new Error(`Atlas could not read ${configPath}: ${typescript.flattenDiagnosticMessageText(loaded.error.messageText, '\n')}`);
    }
    return typescript.parseJsonConfigFileContent(loaded.config, typescript.sys, resolve(configPath, '..')).options;
}
function runtimeModuleSpecifiers(typescript, sourceFile) {
    const specifiers = [];
    const visit = (node) => {
        if (isRuntimeImportDeclaration(typescript, node)) {
            specifiers.push(node.moduleSpecifier.text);
        }
        else if (typescript.isExportDeclaration(node) &&
            !node.isTypeOnly &&
            typescript.isStringLiteral(node.moduleSpecifier)) {
            specifiers.push(node.moduleSpecifier.text);
        }
        else if (isRuntimeModuleCall(typescript, node)) {
            specifiers.push(node.arguments[0].text);
        }
        typescript.forEachChild(node, visit);
    };
    visit(sourceFile);
    return specifiers;
}
function isRuntimeImportDeclaration(typescript, node) {
    if (!typescript.isImportDeclaration(node) ||
        !typescript.isStringLiteral(node.moduleSpecifier)) {
        return false;
    }
    const clause = node.importClause;
    if (!clause)
        return false;
    if (clause.isTypeOnly)
        return false;
    if (clause.name)
        return true;
    const bindings = clause.namedBindings;
    if (!bindings || typescript.isNamespaceImport(bindings))
        return true;
    return bindings.elements.some((element) => !element.isTypeOnly);
}
function isRuntimeModuleCall(typescript, node) {
    if (!typescript.isCallExpression(node) ||
        node.arguments.length !== 1 ||
        !typescript.isStringLiteral(node.arguments[0])) {
        return false;
    }
    return (node.expression.kind === typescript.SyntaxKind.ImportKeyword ||
        (typescript.isIdentifier(node.expression) &&
            node.expression.text === 'require'));
}
function resolveLocalModule(options) {
    const { typescript } = options;
    const resolution = typescript.resolveModuleName(options.specifier, options.containingFile, options.compilerOptions, typescript.sys).resolvedModule;
    if (!resolution)
        return undefined;
    const resolvedFile = resolve(resolution.resolvedFileName);
    const sourceRoot = `${resolve(options.projectRoot)}${sep}`;
    if (!resolvedFile.startsWith(sourceRoot) ||
        resolvedFile.includes(`${sep}node_modules${sep}`)) {
        return undefined;
    }
    return resolvedFile;
}
function isSourceFile(fileName) {
    return SOURCE_EXTENSIONS.has(extname(fileName));
}
function rootPackageName(specifier) {
    const parts = specifier.split('/');
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
function readPackageInfo(requireFromProject, packageName, specifier) {
    try {
        return JSON.parse(readFileSync(requireFromProject.resolve(`${packageName}/package.json`), 'utf8'));
    }
    catch {
        let resolvedEntry;
        try {
            resolvedEntry = requireFromProject.resolve(specifier);
        }
        catch {
            throw new Error(`Atlas could not resolve package metadata for shared dependency "${specifier}".`);
        }
        let directory = resolve(resolvedEntry, '..');
        while (directory !== resolve(directory, '..')) {
            const candidate = join(directory, 'package.json');
            if (existsSync(candidate)) {
                const value = JSON.parse(readFileSync(candidate, 'utf8'));
                if (value.name === packageName && typeof value.version === 'string')
                    return value;
            }
            directory = resolve(directory, '..');
        }
        throw new Error(`Atlas could not resolve package metadata for shared dependency "${specifier}".`);
    }
}
function isCommonJsEntry(entryPoint) {
    const extension = extname(entryPoint);
    if (extension === '.cjs' || extension === '.cts')
        return true;
    if (extension === '.mjs' || extension === '.mts')
        return false;
    let directory = resolve(entryPoint, '..');
    while (directory !== resolve(directory, '..')) {
        const candidate = join(directory, 'package.json');
        if (existsSync(candidate)) {
            return JSON.parse(readFileSync(candidate, 'utf8')).type !== 'module';
        }
        directory = resolve(directory, '..');
    }
    return true;
}
function commonJsNamedExports(entryPoint, visited = new Set()) {
    const resolvedEntry = resolve(entryPoint);
    if (visited.has(resolvedEntry))
        return [];
    visited.add(resolvedEntry);
    let parsed;
    try {
        parsed = parseCommonJs(readFileSync(resolvedEntry, 'utf8'));
    }
    catch {
        return [];
    }
    const requireFromEntry = createRequire(resolvedEntry);
    const reexported = parsed.reexports.flatMap((specifier) => {
        try {
            return commonJsNamedExports(requireFromEntry.resolve(specifier), visited);
        }
        catch {
            return [];
        }
    });
    return [...new Set([...parsed.exports, ...reexported])]
        .filter((name) => name !== 'default' &&
        name !== '__esModule' &&
        /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name))
        .sort();
}
function hasEsmDefaultExport(typescript, entryPoint) {
    const sourceFile = typescript.createSourceFile(entryPoint, readFileSync(entryPoint, 'utf8'), typescript.ScriptTarget.Latest, true);
    return sourceFile.statements.some((statement) => {
        if (typescript.isExportAssignment(statement))
            return true;
        if ((typescript.isClassDeclaration(statement) ||
            typescript.isFunctionDeclaration(statement)) &&
            statement.modifiers?.some(({ kind }) => kind === typescript.SyntaxKind.DefaultKeyword)) {
            return true;
        }
        return (typescript.isExportDeclaration(statement) &&
            statement.exportClause &&
            typescript.isNamedExports(statement.exportClause) &&
            statement.exportClause.elements.some(({ name, propertyName }) => name.text === 'default' || propertyName?.text === 'default'));
    });
}
function sharedFileName(specifier) {
    return specifier
        .replace(/^@/, '')
        .replaceAll('/', '__')
        .replace(/[^a-zA-Z0-9_.-]/g, '_');
}
function reactFederationBuild(options, exposedInputs) {
    const shared = reactSharedDependencies(options, Object.values(exposedInputs));
    const sharedSpecifiers = new Set(shared.map(({ specifier }) => specifier));
    return {
        shared,
        sharedFallbackPlugin: reactSharedFallbackPlugin(shared),
        input: Object.fromEntries([
            ...Object.entries(exposedInputs),
            ...shared.map(({ entryName, specifier }) => [
                entryName,
                sharedProxyId(specifier),
            ]),
        ]),
        external(source) {
            return sharedSpecifiers.has(source);
        },
    };
}
const SHARED_PROXY_PREFIX = 'atlas:shared-proxy:';
const SHARED_ENTRY_PREFIX = 'atlas:shared-entry:';
function sharedProxyId(specifier) {
    return `${SHARED_PROXY_PREFIX}${encodeURIComponent(specifier)}`;
}
function sharedEntryId(specifier) {
    return `${SHARED_ENTRY_PREFIX}${encodeURIComponent(specifier)}`;
}
function reactSharedFallbackPlugin(sharedDependencies) {
    const dependencies = new Map(sharedDependencies.map((dependency) => [dependency.specifier, dependency]));
    const entryPoints = new Map(sharedDependencies.map(({ specifier, entryPoint }) => [
        specifier,
        entryPoint,
    ]));
    return {
        name: 'atlas-react-shared-fallbacks',
        resolveId(source) {
            if (source.startsWith(SHARED_PROXY_PREFIX))
                return `\0${source}`;
            if (!source.startsWith(SHARED_ENTRY_PREFIX))
                return;
            const specifier = decodeURIComponent(source.slice(SHARED_ENTRY_PREFIX.length));
            return entryPoints.get(specifier);
        },
        load(id) {
            if (!id.startsWith(`\0${SHARED_PROXY_PREFIX}`))
                return;
            const specifier = decodeURIComponent(id.slice(SHARED_PROXY_PREFIX.length + 1));
            const entryId = sharedEntryId(specifier);
            const dependency = dependencies.get(specifier);
            if (!dependency)
                return;
            const imports = dependency.namedExports.map((name, index) => `import { ${name} as sharedExport${index} } from ${JSON.stringify(entryId)};`);
            const exports = dependency.namedExports.map((name, index) => `sharedExport${index} as ${name}`);
            return [
                ...imports,
                `export * from ${JSON.stringify(entryId)};`,
                exports.length > 0 ? `export { ${exports.join(', ')} };` : '',
                dependency.hasDefaultExport
                    ? `export { default } from ${JSON.stringify(entryId)};`
                    : '',
            ]
                .filter(Boolean)
                .join('\n');
        },
    };
}
function writeReactDevelopmentFacade(options) {
    const directory = join(options.projectRoot, '.atlas', 'react-development');
    const facadePath = join(directory, `${options.name}.ts`);
    const source = relative(directory, options.sourcePath).replaceAll('\\', '/');
    const sourceSpecifier = source.startsWith('.') ? source : `./${source}`;
    const exports = options.defaultExport
        ? `export { default } from ${JSON.stringify(sourceSpecifier)};`
        : `export * from ${JSON.stringify(sourceSpecifier)};`;
    mkdirSync(directory, { recursive: true });
    writeFileSync(facadePath, `import "@vitejs/plugin-react/preamble";\n${exports}\n`);
    return facadePath;
}
function reactSourceReloadPlugin(projectRoot) {
    const sourceRoot = `${resolve(projectRoot, 'src').replaceAll('\\', '/')}/`;
    return {
        name: 'atlas-react-source-reload',
        apply: 'serve',
        handleHotUpdate({ file, server }) {
            const sourceFile = file.replaceAll('\\', '/');
            if (!sourceFile.startsWith(sourceRoot) ||
                !/\.[cm]?[jt]sx?$/.test(sourceFile))
                return;
            server.ws.send({ type: 'full-reload', path: '*' });
            return [];
        },
    };
}
function createReactHostViteConfig(options) {
    const federation = reactFederationBuild(options, {
        host: reactBootstrapPath(options.projectRoot, 'main.tsx'),
    });
    const developmentHost = writeReactDevelopmentFacade({
        projectRoot: options.projectRoot,
        name: 'host',
        sourcePath: federation.input.host,
        defaultExport: false,
    });
    const metadata = {
        name: reactRemoteName(options.projectName),
        exposes: [{ key: './host', outFileName: 'host.js' }],
        shared: federation.shared.map(({ metadata }) => metadata),
    };
    return {
        plugins: [
            federation.sharedFallbackPlugin,
            reactSourceReloadPlugin(options.projectRoot),
            federationBuildNotificationsPlugin(options.projectRoot),
            federationMetadataPlugin({
                projectRoot: options.projectRoot,
                pluginName: 'atlas-host-metadata',
                metadata,
                devExposes: [
                    {
                        key: './host',
                        outFileName: relative(options.projectRoot, developmentHost),
                    },
                ],
                devShared: federation.shared.map(({ devMetadata }) => devMetadata),
            }),
        ],
        build: {
            target: 'esnext',
            rollupOptions: {
                input: federation.input,
                external: federation.external,
                output: {
                    entryFileNames: ({ name }) => name === 'host' ? 'host.js' : '[name].js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                    assetFileNames: 'assets/[name]-[hash][extname]',
                },
                preserveEntrySignatures: 'exports-only',
            },
        },
    };
}
function createReactAppViteConfig(options) {
    const widgetEntries = createReactWidgetEntries(options);
    const exposes = [
        { key: './entry', outFileName: 'entry.js' },
        ...widgetEntries.map(({ name }) => ({
            key: `./widgets/${name}`,
            outFileName: `widgets/${name}.js`,
        })),
    ];
    const federation = reactFederationBuild(options, Object.fromEntries([
        ['entry', reactBootstrapPath(options.projectRoot, 'entry.tsx')],
        ...widgetEntries.map(({ name, entryPoint }) => [
            `widgets/${name}`,
            resolve(options.projectRoot, entryPoint),
        ]),
    ]));
    const metadata = {
        name: reactRemoteName(options.projectName),
        exposes,
        shared: federation.shared.map(({ metadata }) => metadata),
    };
    const developmentExposes = [
        {
            key: './entry',
            path: writeReactDevelopmentFacade({
                projectRoot: options.projectRoot,
                name: 'entry',
                sourcePath: federation.input.entry,
                defaultExport: true,
            }),
        },
        ...widgetEntries.map(({ name, entryPoint }) => ({
            key: `./widgets/${name}`,
            path: writeReactDevelopmentFacade({
                projectRoot: options.projectRoot,
                name: `widget-${name}`,
                sourcePath: resolve(options.projectRoot, entryPoint),
                defaultExport: true,
            }),
        })),
    ];
    return {
        plugins: [
            federation.sharedFallbackPlugin,
            reactSourceReloadPlugin(options.projectRoot),
            federationBuildNotificationsPlugin(options.projectRoot),
            federationMetadataPlugin({
                projectRoot: options.projectRoot,
                pluginName: 'atlas-native-federation-metadata',
                metadata,
                devShared: federation.shared.map(({ devMetadata }) => devMetadata),
                devExposes: [
                    ...developmentExposes.map(({ key, path }) => ({
                        key,
                        outFileName: relative(options.projectRoot, path),
                    })),
                ],
            }),
        ],
        build: {
            target: 'esnext',
            rollupOptions: {
                input: federation.input,
                external: federation.external,
                output: {
                    entryFileNames: '[name].js',
                    chunkFileNames: 'chunks/[name]-[hash].js',
                    assetFileNames: 'assets/[name]-[hash][extname]',
                },
                preserveEntrySignatures: 'exports-only',
            },
        },
    };
}
function reactWidgetEntry(name, reactMajor) {
    const rootAdapter = reactMajor === 17
        ? `import type { ReactNode } from "react";
import { render, unmountComponentAtNode } from "react-dom";

function createRoot(container: Element) {
  return {
    render(element: ReactNode) { render(element, container); },
    unmount() { unmountComponentAtNode(container); }
  };
}`
        : `import { createRoot } from "react-dom/client";`;
    return `import { createElement, type ComponentProps } from "react";
${rootAdapter}
import { defineExportedWidget } from "@atlas/sdk/react";
import Widget from ${JSON.stringify(`../../src/exported-widgets/${name}/index`)};

export default defineExportedWidget({
  createRoot,
  createElement: ({ props }) => createElement(Widget, props as ComponentProps<typeof Widget>)
});
`;
}
function createAngularFederationConfig(options) {
    const requireFromProject = createRequire(join(options.projectRoot, 'package.json'));
    const { shareAll, withNativeFederation } = requireFromProject('@angular-architects/native-federation/config');
    return withNativeFederation(createAngularFederationOptions(options, shareAll));
}
function createAngularFederationOptions(options, shareAll) {
    const { projectRoot, name, expose, exposes: additionalExposes = {}, shared: additionalShared = {}, skip: additionalSkip = [], ...nativeFederationOptions } = options;
    const widgetExposes = Object.fromEntries(createAngularWidgetEntries(projectRoot).map((entry) => [
        `./widgets/${entry.name}`,
        projectPath(projectRoot, entry.entryPoint),
    ]));
    const atlasExposes = expose === 'host'
        ? { './host': sourcePath(projectRoot, 'bootstrap.ts') }
        : expose === 'app'
            ? {
                './entry': sourcePath(projectRoot, 'entry.ts'),
                ...widgetExposes,
            }
            : {};
    return {
        ...nativeFederationOptions,
        name,
        exposes: { ...additionalExposes, ...atlasExposes },
        shared: {
            ...shareAll(ANGULAR_SHARED_DEPENDENCY_OPTIONS, {
                projectPath: projectRoot,
                overrides: {
                    '@angular/core': {
                        ...ANGULAR_SHARED_DEPENDENCY_OPTIONS,
                        includeSecondaries: {
                            keepAll: true,
                            skip: [],
                        },
                    },
                },
            }),
            ...additionalShared,
        },
        skip: [...new Set([...ANGULAR_FEDERATION_SKIP, ...additionalSkip])],
    };
}
