import { reactRemoteName } from "./react-names.js";

export function reactHostViteConfig(compilerTarget: string): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "${compilerTarget}", panicThreshold: "none" }]]
      }
    })
  ],
  server: { port: 4200 },
  build: { target: "esnext" }
});
`;
}

export function reactMicrofrontendViteConfig(name: string, compilerTarget: string): string {
  return `import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const componentsRoot = resolve(__dirname, "src/exported-components");
const componentIds = existsSync(componentsRoot)
  ? readdirSync(componentsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
const exposes = [
  { key: "./entry", outFileName: "entry.js" },
  ...componentIds.map((id) => ({
    key: \`./components/\${id}\`,
    outFileName: \`components/\${id}.js\`
  }))
];

function atlasFederationMetadata(): Plugin {
  const metadata = { name: "${reactRemoteName(name)}", exposes, shared: [] };

  return {
    name: "atlas-native-federation-metadata",
    configureServer(server) {
      server.middlewares.use("/remoteEntry.json", (_request, response) => {
        response.setHeader("content-type", "application/json");
        response.setHeader("access-control-allow-origin", "*");
        response.end(
          JSON.stringify({
            ...metadata,
            exposes: [
              {
                key: "./entry",
                outFileName: "src/entry.tsx",
                dev: { entryPoint: "src/entry.tsx" }
              },
              ...componentIds.map((id) => ({
                key: \`./components/\${id}\`,
                outFileName: \`src/exported-components/\${id}/index.tsx\`,
                dev: { entryPoint: \`src/exported-components/\${id}/index.tsx\` }
              }))
            ]
          })
        );
      });
    },
    closeBundle() {
      writeFileSync(resolve(__dirname, "dist/remoteEntry.json"), JSON.stringify(metadata, null, 2));
    }
  };
}

function atlasReactRefreshPreamble(): Plugin {
  const sourceEntries = new Set([
    "src/entry.tsx",
    ...componentIds.map((id) => \`src/exported-components/\${id}/index.tsx\`)
  ]);

  return {
    name: "atlas-react-refresh-preamble",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const sourcePath = id.split("?")[0].replaceAll("\\\\", "/");
      if (!sourceEntries.has(sourcePath.slice(sourcePath.lastIndexOf("src/")))) return;
      return \`import "@vitejs/plugin-react/preamble";\\n\${code}\`;
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "${compilerTarget}", panicThreshold: "none" }]]
      }
    }),
    atlasReactRefreshPreamble(),
    atlasFederationMetadata()
  ],
  server: { port: 4201, cors: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: Object.fromEntries([
        ["entry", resolve(__dirname, "src/entry.tsx")],
        ...componentIds.map((id) => [\`components/\${id}\`, resolve(componentsRoot, id, "index.tsx")])
      ]),
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      },
      preserveEntrySignatures: "exports-only"
    }
  }
});
`;
}
