#!/usr/bin/env node
import { runAtlasHostServer } from "./index.js";

async function main(): Promise<void> {
  await runAtlasHostServer();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
