import { createAtlasHostServer, hasAssetExtension, indexHtml, runtimeFromEnvironment } from "../dist/index.js";
import { ATLAS_BROWSER_LOADER } from "../dist/browser-loader.js";

export class HostServerDriver {
  readonly runtime = runtimeFromEnvironment;

  routes(): string[] {
    const server = createAtlasHostServer({
      port: 0,
      runtime: {
        schemaVersion: "1",
        hostId: "customer-host",
        catalogUrl: "https://cdn.example/atlas/hosts/customer-host/catalog.json",
        allowOverrides: false
      },
      assetOrigins: ["https://cdn.example"]
    });
    const router = (server.app as unknown as {
      router: { stack: Array<{ route?: { path: string } }> };
    }).router;
    return router.stack.flatMap((layer) => layer.route ? [layer.route.path] : []);
  }

  hasAssetPath(path: string): boolean {
    return hasAssetExtension(path);
  }

  shell(): string {
    return indexHtml();
  }

  loader(): string {
    return ATLAS_BROWSER_LOADER;
  }
}
