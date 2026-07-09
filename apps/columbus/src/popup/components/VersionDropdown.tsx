import React from "react";
import { Dropdown } from "@wix/design-system";
import { versionDisabled, versionLabel } from "../manifest-utils.js";
import { versionKey } from "../../manifest-versions.js";
import type { Manifest } from "../types.js";

interface VersionDropdownProps {
  id: string;
  ariaLabel: string;
  disabled: boolean;
  selectedId: string;
  versions: Manifest[];
  hostId: string;
  onChange: (value: string) => void;
}

export function VersionDropdown({ id, ariaLabel, disabled, selectedId, versions, hostId, onChange }: VersionDropdownProps): JSX.Element {
  return (
    <Dropdown
      id={id}
      ariaLabel={ariaLabel}
      disabled={disabled || versions.length === 0}
      selectedId={selectedId}
      placeholder="No versions found"
      options={versions.map((manifest) => ({
        id: versionKey(manifest),
        value: versionLabel(manifest),
        disabled: versionDisabled(manifest, hostId)
      }))}
      onSelect={(option: { id: string | number }) => onChange(String(option.id))}
    />
  );
}
