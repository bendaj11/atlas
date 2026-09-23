import type {
  AtlasAppEntry,
  AtlasExportedWidgetEntry,
} from '@atlas/sdk/lifecycle';

export type MountableEntry = AtlasAppEntry & AtlasExportedWidgetEntry;

export function unwrapDefaultExport(module: unknown): unknown {
  if (typeof module !== 'object' || module === null || !('default' in module))
    return module;

  return module.default ?? module;
}

export function isMountableEntry(value: unknown): value is MountableEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mount' in value &&
    typeof value.mount === 'function'
  );
}
