import type { ReactNode } from 'react';
import { Badge, Box, Dropdown, Text } from '@wix/design-system';
import { versionDisabled, versionLabel } from '../../../popup/manifest-utils';
import { versionKey } from '../../../manifest-versions';
import type { Manifest } from '../../../popup/types';

interface VersionDropdownProps {
  disabled: boolean;
  selectedId: string;
  versions: Manifest[];
  hostId: string;
  currentId?: string;
  onChange: (value: string) => void;
}

export function OverrideVersionDropdown({
  disabled,
  selectedId,
  versions,
  hostId,
  currentId,
  onChange,
}: VersionDropdownProps) {
  return (
    <Box direction="vertical">
      <Dropdown
        size="small"
        disabled={disabled || versions.length === 0}
        selectedId={selectedId}
        placeholder="No versions found"
        options={versions.map((manifest) => {
          const label = versionLabel(manifest);

          return {
            id: versionKey(manifest),
            label,
            value: versionOptionLabel({ manifest, currentId, label }),
            disabled: versionDisabled({ manifest, hostId }),
          };
        })}
        onSelect={(option: { id: string | number }) =>
          onChange(String(option.id))
        }
      />
    </Box>
  );
}

function versionOptionLabel({
  manifest,
  currentId,
  label,
}: {
  manifest: Manifest;
  currentId: string | undefined;
  label: string;
}): ReactNode {
  const isCurrentProduction =
    manifest.channel === 'production' && versionKey(manifest) === currentId;
  if (!isCurrentProduction) return label;

  return (
    <Box gap="SP1" verticalAlign="middle">
      <Text size="small">{label}</Text>

      <Badge size="tiny" skin="neutralSuccess">
        current
      </Badge>
    </Box>
  );
}
