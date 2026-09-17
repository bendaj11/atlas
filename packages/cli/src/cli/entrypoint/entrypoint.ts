#!/usr/bin/env node
import { ensureActionableError } from '@atlas/schema';
import { runAtlasCli } from '../cli.service.js';
import { formatErrorWithCauses, ui } from '../../shared/index.js';

runAtlasCli().catch((error: unknown) => {
  ui.error(formatErrorWithCauses(ensureActionableError(error)));
  process.exitCode = 1;
});
