#!/usr/bin/env node
import { ensureActionableError } from '@atlas/schema';
import { runAtlasCli } from '../cli.service.js';
import { ui } from '../ui/ui.js';

runAtlasCli().catch((error: unknown) => {
  ui.error(ensureActionableError(error).message);
  process.exitCode = 1;
});
