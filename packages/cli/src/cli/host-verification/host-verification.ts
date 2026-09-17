import { ui, type CliArguments } from '../../shared/index.js';
import {
  AtlasVerifyService,
  type AtlasVerificationCheck,
} from '../../verification/index.js';

export function collectConfiguredHostUrls({
  args,
  configured = [],
}: {
  args: CliArguments;
  configured?: readonly string[];
}): string[] {
  const singleHostUrl = args.flag('host-url') ?? process.env.ATLAS_HOST_URL;

  return [
    ...new Set([
      ...splitUrlList(args.flag('host-urls') ?? process.env.ATLAS_HOST_URLS),
      ...(singleHostUrl ? [singleHostUrl] : []),
      ...configured,
    ]),
  ];
}

export async function verifyHostUrls(
  hostUrls: readonly string[],
): Promise<void> {
  for (const hostUrl of hostUrls) {
    const report = await new AtlasVerifyService().run({ hostUrl });
    report.checks.forEach(printVerificationCheck);

    if (report.failures)
      throw new Error(
        `Deployment verification failed for ${hostUrl} with ${report.failures} failure(s).`,
      );
  }
}

function printVerificationCheck(check: AtlasVerificationCheck): void {
  const message = `${check.subject}: ${check.message}`;

  if (check.status === 'pass') ui.success(message);
  else if (check.status === 'warning') ui.warning(message);
  else ui.error(message);
}

function splitUrlList(value: string | undefined): string[] {
  return value?.split(/[\s,]+/).filter(Boolean) ?? [];
}
