export function reactTsconfig(): unknown {
  return {
    compilerOptions: {
      target: "ES2022", useDefineForClassFields: true, lib: ["ES2022", "DOM", "DOM.Iterable"],
      module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true,
      noEmit: true, skipLibCheck: true, allowImportingTsExtensions: true, types: ["vite/client"]
    },
    include: ["src", "vite.config.ts", "atlas.config.ts"]
  };
}

export function reactAtlasTsconfig(): unknown {
  return { extends: "./tsconfig.json", compilerOptions: { noEmit: false, allowImportingTsExtensions: false, outDir: ".atlas", module: "Node16", moduleResolution: "Node16", types: ["node"] }, files: ["atlas.config.ts"], include: [] };
}
