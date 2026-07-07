import { reactVersionProfile, atlasPackageRange, type ReactVersionProfile } from "./generator-versions.js";
import type { AtlasGeneratedFile, AtlasGeneratorOptions } from "./generator-types.js";
import { atlasConfig, atlasHostConfig, atlasHostStyles, json, title } from "./common-generator.js";

const REACT_COMPILER_VERSION = "1.0.0";

export function generateReactHostFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = reactVersionProfile(options);
  return [
    { path: "package.json", contents: json(reactPackage({ packageName: options.packageName ?? name, projectName: name, host: true, profile })) },
    { path: "tsconfig.json", contents: json(reactTsconfig()) },
    { path: "tsconfig.atlas.json", contents: json(reactAtlasTsconfig()) },
    { path: "vite.config.ts", contents: reactHostViteConfig(profile.compilerTarget) },
    { path: "atlas.config.ts", contents: atlasHostConfig(options) },
    { path: "public/remoteEntry.json", contents: json({ name: remoteName(name), exposes: [], shared: [] }) },
    { path: "index.html", contents: reactIndex("Atlas React Host") },
    { path: "src/styles.css", contents: atlasHostStyles() },
    { path: "src/main.tsx", contents: reactHostMain(profile) }
  ];
}

export function generateReactMicrofrontendFiles(options: AtlasGeneratorOptions): AtlasGeneratedFile[] {
  const { name } = options;
  const profile = reactVersionProfile(options);
  return [
    { path: "package.json", contents: json(reactPackage({ packageName: options.packageName ?? name, projectName: name, host: false, profile })) },
    { path: "tsconfig.json", contents: json(reactTsconfig()) },
    { path: "tsconfig.atlas.json", contents: json(reactAtlasTsconfig()) },
    { path: "vite.config.ts", contents: reactMicrofrontendViteConfig(name, profile.compilerTarget) },
    { path: "atlas.config.ts", contents: atlasConfig(options, false) },
    { path: "index.html", contents: reactIndex(`${title(name)} assets`) },
    { path: "src/styles.css", contents: "" },
    { path: "src/app/app.tsx", contents: reactMicrofrontendApp(name) },
    { path: "src/entry.tsx", contents: reactMicrofrontendEntry(name, profile) },
    { path: "src/exported-components/README.md", contents: `# Exported widgets\n\nCreate \`<widget-id>/index.tsx\`; Atlas exposes it automatically through Native Federation. Consumers declare \`owner-mf/widget-id\` in \`uses\`.\n` }
  ];
}

interface ReactPackageOptions {
  packageName: string;
  projectName: string;
  host: boolean;
  profile: ReactVersionProfile;
}

function reactPackage(options: ReactPackageOptions): unknown {
  const { packageName, projectName, host, profile } = options;
  return {
    name: packageName,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: host ? `atlas runtime-config ${projectName} && vite --host 0.0.0.0` : "vite --host 0.0.0.0",
      "atlas:config": "tsc -p tsconfig.atlas.json",
      build: host ? `atlas runtime-config ${projectName} && tsc -b && vite build` : "tsc -p tsconfig.atlas.json && tsc -b && vite build",
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
      "react-router-dom": profile.routerVersion,
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

function reactTsconfig(): unknown {
  return {
    compilerOptions: {
      target: "ES2022", useDefineForClassFields: true, lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true,
      noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, types: ["vite/client"]
    },
    include: ["src", "vite.config.ts"]
  };
}

function reactAtlasTsconfig(): unknown {
  return { extends: "./tsconfig.json", compilerOptions: { noEmit: false, allowImportingTsExtensions: false, outDir: ".atlas", module: "Node16", moduleResolution: "Node16", types: ["node"] }, files: ["atlas.config.ts"], include: [] };
}

function reactHostViteConfig(compilerTarget: string): string {
  return `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({ plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "${compilerTarget}", panicThreshold: "none" }]] } })], server: { port: 4200 }, build: { target: "esnext" } });\n`;
}

function reactMicrofrontendViteConfig(name: string, compilerTarget: string): string {
  return `import { existsSync, readdirSync, writeFileSync } from "node:fs";\nimport { resolve } from "node:path";\nimport { defineConfig, type Plugin } from "vite";\nimport react from "@vitejs/plugin-react";\n\nconst componentsRoot = resolve(__dirname, "src/exported-components");\nconst componentIds = existsSync(componentsRoot) ? readdirSync(componentsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];\nconst exposes = [{ key: "./entry", outFileName: "entry.js" }, ...componentIds.map((id) => ({ key: \`./components/\${id}\`, outFileName: \`components/\${id}.js\` }))];\n\nfunction atlasFederationMetadata(): Plugin {\n  const metadata = { name: "${remoteName(name)}", exposes, shared: [] };\n  return {\n    name: "atlas-native-federation-metadata",\n    configureServer(server) {\n      server.middlewares.use("/remoteEntry.json", (_request, response) => { response.setHeader("content-type", "application/json"); response.setHeader("access-control-allow-origin", "*"); response.end(JSON.stringify({ ...metadata, exposes: [{ key: "./entry", outFileName: "src/entry.tsx", dev: { entryPoint: "src/entry.tsx" } }, ...componentIds.map((id) => ({ key: \`./components/\${id}\`, outFileName: \`src/exported-components/\${id}/index.tsx\`, dev: { entryPoint: \`src/exported-components/\${id}/index.tsx\` } }))] })); });\n    },\n    closeBundle() { writeFileSync(resolve(__dirname, "dist/remoteEntry.json"), JSON.stringify(metadata, null, 2)); }\n  };\n}\n\nexport default defineConfig({\n  base: "./",\n  plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "${compilerTarget}", panicThreshold: "none" }]] } }), atlasFederationMetadata()],\n  server: { port: 4201, cors: true },\n  build: {\n    target: "esnext",\n    rollupOptions: {\n      input: Object.fromEntries([["entry", resolve(__dirname, "src/entry.tsx")], ...componentIds.map((id) => [\`components/\${id}\`, resolve(componentsRoot, id, "index.tsx")])]),\n      output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" },\n      preserveEntrySignatures: "exports-only"\n    }\n  }\n});\n`;
}

function reactIndex(pageTitle: string): string {
  return `<!doctype html>\n<html lang="en">\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${pageTitle}</title><script type="esms-options">{ "shimMode": true, "mapOverrides": true }</script></head>\n<body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>\n</html>\n`;
}

function reactHostMain(profile: ReactVersionProfile): string {
  const rootImport = profile.major === 17
    ? 'import { render, unmountComponentAtNode } from "react-dom";'
    : 'import { flushSync } from "react-dom";\nimport { createRoot } from "react-dom/client";';
  const mount = profile.major === 17
    ? "render(<StrictMode><RouterProvider router={router} /></StrictMode>, root);\nif (import.meta.hot) import.meta.hot.dispose(() => unmountComponentAtNode(root));"
    : "const reactRoot = createRoot(root);\nflushSync(() => reactRoot.render(<StrictMode><RouterProvider router={router} /></StrictMode>));\nif (import.meta.hot) import.meta.hot.dispose(() => reactRoot.unmount());";
  return `import "es-module-shims";\nimport { StrictMode } from "react";\n${rootImport}\nimport { createBrowserRouter, RouterProvider } from "react-router-dom";\nimport { initFederation, loadRemoteModule } from "@softarc/native-federation-runtime";\nimport { startHost } from "@atlas/runtime/react";\nimport { createFetchAtlasHttpClient, type AtlasHostData } from "@atlas/sdk";\nimport atlasConfig from "../atlas.config";\nimport "./styles.css";\n\nfunction Shell() { return <><div data-atlas-host-status /><header><strong>Atlas</strong><div data-atlas-slot="header" /></header><nav data-atlas-navigation aria-label="Application" /><main data-atlas-route-outlet /></>; }\nconst router = createBrowserRouter([{ path: "*", Component: Shell }]);\nconst root = document.getElementById("root");\nif (!root) throw new Error("Atlas React host root was not found.");\nconst hostData: AtlasHostData = { hostId: atlasConfig.id, name: atlasConfig.name ?? atlasConfig.id };\n${mount}\nvoid startHost({ router, federation: { initFederation, loadRemoteModule }, showToast: (toast) => console.info("[Atlas toast]", toast.title), getCurrentUser: async () => ({ id: "local-user", displayName: "Local Developer" }), hostData, httpClient: createFetchAtlasHttpClient(fetch) }).catch((error) => console.error("Atlas host failed to start", error));\n`;
}

function reactMicrofrontendEntry(name: string, profile: ReactVersionProfile): string {
  const root = profile.major === 17
    ? 'import type { ReactNode } from "react";\nimport { render, unmountComponentAtNode } from "react-dom";\n\nfunction createRoot(container: Element) {\n  return { render(element: ReactNode) { render(element, container); }, unmount() { unmountComponentAtNode(container); } };\n}'
    : 'import { createRoot } from "react-dom/client";';
  return `import { createElement } from "react";\n${root}\nimport { createMemoryRouter, RouterProvider } from "react-router-dom";\nimport { createRouterOptions, createRoutedMicrofrontend } from "@atlas/sdk/react";\nimport { routes } from "./app/app";\n\nif (import.meta.hot) await import("@vitejs/plugin-react/preamble");\n\nexport default createRoutedMicrofrontend({\n  createRoot,\n  createRouter: ({ context }) => createMemoryRouter(routes, createRouterOptions(context)),\n  createElement: (router) => createElement(RouterProvider, { router })\n});\n`;
}

function reactMicrofrontendApp(name: string): string {
  return `import { Link, Outlet, type RouteObject } from "react-router-dom";
import { useAtlasSdk } from "@atlas/sdk/react";
import "../styles.css";

function Layout() {
  const atlas = useAtlasSdk();

  return (
    <section>
      <h1>${title(name)}</h1>
      <button type="button" onClick={() => atlas.toast.open({ title: "${title(name)} is ready" })}>
        Show toast
      </button>
      <nav>
        <Link to="/">Home</Link>
        <Link to="details/42">Details</Link>
      </nav>
      <Outlet />
    </section>
  );
}

function Home() {
  return <p>${title(name)} home</p>;
}

function Details() {
  return <p>Routed details page</p>;
}

export const routes: RouteObject[] = [
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "details/:id", Component: Details }
    ]
  }
];
`;
}

function remoteName(name: string): string {
  return `atlas_${name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}
