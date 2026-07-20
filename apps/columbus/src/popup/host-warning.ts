import type { AtlasHostData as HostData } from '../contracts.js';

export function createHostWarningMessage(hostData: HostData): string {
  const warnings = [...hostData.runtimeErrors, ...hostData.versionErrors];
  if (warnings.length === 0) return '';
  return warnings.join(' ');
}
