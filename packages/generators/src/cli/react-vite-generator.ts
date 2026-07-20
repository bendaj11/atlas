import { reactRemoteName } from "./react-names.js";

export function reactHostViteConfig(compilerTarget: string, devServerPort = 4200): string {
  return `import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const metadata = { name: "atlas_host", exposes: [{ key: "./host", outFileName: "host.js" }], shared: [] };
const reactCompilerConfig = { target: "${compilerTarget}", panicThreshold: "none" };
function atlasHostMetadata(): Plugin {
  return {
    name: "atlas-host-metadata",
    configureServer(server) {
      server.middlewares.use("/remoteEntry.json", (_request, response) => {
        response.setHeader("content-type", "application/json");
        response.setHeader("access-control-allow-origin", "*");
        response.end(JSON.stringify({ ...metadata, exposes: [{ key: "./host", outFileName: "src/host.tsx" }] }));
      });
    },
    closeBundle() {
      writeFileSync(resolve(__dirname, "dist/remoteEntry.json"), JSON.stringify(metadata, null, 2));
    }
  };
}

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", reactCompilerConfig]]
      }
    }),
    atlasHostMetadata()
  ],
  server: { port: ${devServerPort}, cors: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: { host: resolve(__dirname, "src/host.tsx") },
      output: {
        entryFileNames: "host.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      },
      preserveEntrySignatures: "exports-only"
    }
  }
});
`;
}

export function reactAppViteConfig(name: string, compilerTarget: string, devServerPort = 4201): string {
  return `import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const { createReactWidgetEntries } = require("@atlas/sdk/federation-config") as {
  createReactWidgetEntries(options: { projectRoot: string; reactMajor: number }): Array<{ name: string; entryPoint: string }>;
};
const widgetEntries = createReactWidgetEntries({ projectRoot: __dirname, reactMajor: ${compilerTarget} });
const exposes = [
  { key: "./entry", outFileName: "entry.js" },
  ...widgetEntries.map(({ name }) => ({
    key: \`./widgets/\${name}\`,
    outFileName: \`widgets/\${name}.js\`
  }))
];
const reactCompilerConfig = { target: "${compilerTarget}", panicThreshold: "none" };
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
              ...widgetEntries.map(({ name, entryPoint }) => ({
                key: \`./widgets/\${name}\`,
                outFileName: entryPoint,
                dev: { entryPoint }
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
    ...widgetEntries.map(({ entryPoint }) => entryPoint)
  ]);

  return {
    name: "atlas-react-refresh-preamble",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const sourcePath = id.split("?")[0].replaceAll("\\\\", "/");
      if (![...sourceEntries].some((entryPoint) => sourcePath.endsWith(entryPoint))) return;
      return \`import "@vitejs/plugin-react/preamble";\\n\${code}\`;
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", reactCompilerConfig]]
      }
    }),
    atlasReactRefreshPreamble(),
    atlasFederationMetadata()
  ],
  server: { port: ${devServerPort}, cors: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: Object.fromEntries([
        ["entry", resolve(__dirname, "src/entry.tsx")],
        ...widgetEntries.map(({ name, entryPoint }) => [\`widgets/\${name}\`, resolve(__dirname, entryPoint)])
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
