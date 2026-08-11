#!/usr/bin/env node
import { ensureActionableError } from '@atlas/schema';
import { runAtlasCli } from '../cli.service.js';
import { formatErrorWithCauses } from '../cli-error/cli-error.js';
import { ui } from '../ui/ui.js';

runAtlasCli().catch((error: unknown) => {
  ui.error(formatErrorWithCauses(ensureActionableError(error)));
  process.exitCode = 1;
});
