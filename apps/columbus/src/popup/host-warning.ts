import type { AtlasHostData as HostData } from '../contracts.js';

export function createHostWarningMessage(hostData: HostData): string {
  const errorCount =
    hostData.runtimeErrors.length + hostData.versionErrors.length;
  if (errorCount === 0) return '';
  return `${errorCount} host warning${errorCount === 1 ? '' : 's'}`;
}
