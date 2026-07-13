#!/usr/bin/env node
import { closeAtlasHostServer, createAtlasHostServer, runtimeFromEnvironment } from "./index.js";

async function main(): Promise<void> {
  const port = process.env.PORT ? Number(process.env.PORT) : undefined;
  const assetOrigins = process.env.ATLAS_ASSET_ORIGINS?.split(/[\s,]+/).filter(Boolean);
  const server = await createAtlasHostServer({
    runtime: runtimeFromEnvironment(),
    ...(port !== undefined ? { port } : {}),
    ...(assetOrigins ? { assetOrigins } : {})
  }).listen();
  const shutdown = async (): Promise<void> => {
    await closeAtlasHostServer(server);
    process.exitCode = 0;
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
