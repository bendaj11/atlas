import express, { type Express } from "express";
import { atlas, hasAssetExtension, indexHtml, runtimeFromEnvironment } from "../dist/index.js";
import { ATLAS_BROWSER_LOADER } from "../dist/browser-loader.js";

export class HostServerDriver {
  readonly runtime = runtimeFromEnvironment;

  routes(): string[] {
    const router = atlas({
      runtime: {
        schemaVersion: "1",
        hostId: "customer-host",
        catalogUrl: "https://cdn.example/atlas/hosts/customer-host/catalog.json",
        allowOverrides: false
      },
      assetOrigins: ["https://cdn.example"]
    });
    const stack = (router as unknown as { stack: Array<{ route?: { path: string } }> }).stack;
    return stack.flatMap((layer) => layer.route ? [layer.route.path] : []);
  }

  compositionRoutes(configure: (app: Express) => void): string[] {
    const app = express();
    configure(app);
    const atlasRouter = atlas({
      runtime: {
        schemaVersion: "1",
        hostId: "customer-host",
        catalogUrl: "https://cdn.example/atlas/hosts/customer-host/catalog.json",
        allowOverrides: false
      },
      log: { info() {} }
    });
    app.use(atlasRouter);
    const stack = (app as unknown as {
      router: { stack: Array<{ route?: { path: string }; handle: unknown }> };
    }).router.stack;
    return stack.flatMap((layer) => {
      if (layer.route) return [layer.route.path];
      return layer.handle === atlasRouter ? ["<atlas>"] : [];
    });
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
