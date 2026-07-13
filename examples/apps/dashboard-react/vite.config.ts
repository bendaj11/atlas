import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const widgetsRoot = resolve(__dirname, "src/exported-widgets");
const widgetIds = existsSync(widgetsRoot) ? readdirSync(widgetsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
const exposes = [{ key: "./entry", outFileName: "entry.js" }, ...widgetIds.map((id) => ({ key: `./widgets/${id}`, outFileName: `widgets/${id}.js` }))];

function atlasFederationMetadata(): Plugin {
  const metadata = { name: "atlas_dashboard_react", exposes, shared: [] };
  return {
    name: "atlas-native-federation-metadata",
    configureServer(server) {
      server.middlewares.use("/remoteEntry.json", (_request, response) => { response.setHeader("content-type", "application/json"); response.setHeader("access-control-allow-origin", "*"); response.end(JSON.stringify({ ...metadata, exposes: [{ key: "./entry", outFileName: "src/entry.tsx", dev: { entryPoint: "src/entry.tsx" } }, ...widgetIds.map((id) => ({ key: `./widgets/${id}`, outFileName: `src/exported-widgets/${id}/index.tsx`, dev: { entryPoint: `src/exported-widgets/${id}/index.tsx` } }))] })); });
    },
    closeBundle() { writeFileSync(resolve(__dirname, "dist/remoteEntry.json"), JSON.stringify(metadata, null, 2)); }
  };
}

function atlasReactRefreshPreamble(): Plugin {
  const sourceEntries = new Set(["src/entry.tsx", ...widgetIds.map((id) => `src/exported-widgets/${id}/index.tsx`)]);
  return {
    name: "atlas-react-refresh-preamble",
    apply: "serve",
    enforce: "pre",
    transform(code, id) {
      const sourcePath = id.split("?")[0].replaceAll("\\", "/");
      if (!sourceEntries.has(sourcePath.slice(sourcePath.lastIndexOf("src/")))) return;
      return `import "@vitejs/plugin-react/preamble";\n${code}`;
    }
  };
}

export default defineConfig({
  base: "./",
  plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "19", panicThreshold: "none" }]] } }), atlasReactRefreshPreamble(), atlasFederationMetadata()],
  resolve: {
    alias: [
      { find: /^react(\/.*)?$/, replacement: `${resolve(__dirname, "node_modules/react")}$1` },
      { find: /^react-dom(\/.*)?$/, replacement: `${resolve(__dirname, "node_modules/react-dom")}$1` }
    ]
  },
  server: { port: 4201, cors: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: Object.fromEntries([["entry", resolve(__dirname, "src/entry.tsx")], ...widgetIds.map((id) => [`widgets/${id}`, resolve(widgetsRoot, id, "index.tsx")])]),
      output: { entryFileNames: "[name].js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" },
      preserveEntrySignatures: "exports-only"
    }
  }
});
