import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const metadata = { name: "atlas_demo_react_host", exposes: [{ key: "./host", outFileName: "host.js" }], shared: [] };

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
  plugins: [react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "19", panicThreshold: "none" }]] } }), atlasHostMetadata()],
  resolve: {
    alias: [
      { find: /^react(\/.*)?$/, replacement: `${resolve(__dirname, "node_modules/react")}$1` },
      { find: /^react-dom(\/.*)?$/, replacement: `${resolve(__dirname, "node_modules/react-dom")}$1` }
    ]
  },
  server: { port: 4200, cors: true },
  build: {
    target: "esnext",
    rollupOptions: {
      input: { host: resolve(__dirname, "src/host.tsx") },
      output: { entryFileNames: "host.js", chunkFileNames: "chunks/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" },
      preserveEntrySignatures: "exports-only"
    }
  }
});
