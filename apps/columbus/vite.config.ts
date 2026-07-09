import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import nodeFileSystem from "@file-services/node";
import { generateStylableJSModuleSource, Stylable } from "@stylable/core";
import { resolveNamespace } from "@stylable/node";
import { StylableOptimizer } from "@stylable/optimizer";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [stylableVitePlugin(), react()],
  root: "src",
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: "../dist",
    rollupOptions: {
      input: {
        "badge-script": resolve(directory, "src/badge-script.ts"),
        background: resolve(directory, "src/background.ts"),
        "content-script": resolve(directory, "src/content-script.ts"),
        popup: resolve(directory, "src/popup.html")
      },
      output: {
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "[name].js"
      }
    }
  }
});

function stylableVitePlugin(): Plugin {
  const stylable = new Stylable({
    fileSystem: nodeFileSystem,
    mode: "production",
    optimizer: new StylableOptimizer(),
    projectRoot: directory,
    resolveNamespace
  });

  return {
    name: "atlas-stylable-vite",
    enforce: "pre",
    resolveId(source, importer) {
      if (!source.endsWith(".st.css") || !importer) return null;
      return stylableId(resolve(dirname(plainImporter(importer)), source));
    },
    load(id) {
      return isStylableModule(id) ? readFileSync(stylablePath(id), "utf8") : null;
    },
    transform(source, id) {
      if (!isStylableModule(id)) return null;
      const path = stylablePath(id);
      const { meta, exports } = stylable.transform(stylable.analyze(path, source));
      const moduleCode = generateStylableJSModuleSource({
        imports: [],
        jsExports: exports,
        moduleType: "esm",
        namespace: meta.namespace,
        varType: "const"
      });
      return {
        code: `${injectStyleSource(path, meta.targetAst.toString())}\n${moduleCode}`,
        map: { mappings: "" }
      };
    }
  };
}

function isStylableModule(id: string): boolean {
  return id.startsWith("\0stylable:");
}

function stylablePath(id: string): string {
  return Buffer.from(id.slice("\0stylable:".length), "base64url").toString("utf8");
}

function plainImporter(importer: string): string {
  return importer.startsWith("\0stylable:") ? stylablePath(importer) : importer.split("?")[0];
}

function stylableId(path: string): string {
  return `\0stylable:${Buffer.from(path).toString("base64url")}`;
}

function injectStyleSource(id: string, css: string): string {
  return `
const cssId = ${JSON.stringify(`stylable:${id}`)};
if (typeof document !== "undefined" && !document.querySelector(\`style[data-stylable-id="\${cssId}"]\`)) {
  const style = document.createElement("style");
  style.dataset.stylableId = cssId;
  style.textContent = ${JSON.stringify(css)};
  document.head.append(style);
}
`;
}
