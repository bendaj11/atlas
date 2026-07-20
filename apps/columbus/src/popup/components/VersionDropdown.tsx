import React from 'react';
import { Dropdown } from '@wix/design-system';
import { versionDisabled, versionLabel } from '../manifest-utils.js';
import { versionKey } from '../../manifest-versions.js';
import type { Manifest } from '../types.js';

interface VersionDropdownProps {
  id: string;
  ariaLabel: string;
  disabled: boolean;
  selectedId: string;
  versions: Manifest[];
  hostId: string;
  currentId?: string;
  onChange: (value: string) => void;
}

export function VersionDropdown({
  id,
  ariaLabel,
  disabled,
  selectedId,
  versions,
  hostId,
  currentId,
  onChange,
}: VersionDropdownProps) {
  return (
    <Dropdown
      id={id}
      ariaLabel={ariaLabel}
      disabled={disabled || versions.length === 0}
      selectedId={selectedId}
      placeholder="No versions found"
      options={versions.map((manifest) => ({
        id: versionKey(manifest),
        value: versionOptionLabel(manifest, currentId),
        disabled: versionDisabled(manifest, hostId),
      }))}
      onSelect={(option: { id: string | number }) =>
        onChange(String(option.id))
      }
    />
  );
}

function versionOptionLabel(
  manifest: Manifest,
  currentId: string | undefined,
): string {
  if (manifest.channel !== 'production') return versionLabel(manifest);
  const status =
    versionKey(manifest) === currentId
      ? 'Current production'
      : 'Previous production';
  return `${status} · ${versionLabel(manifest)}`;
}
