import {
  Badge,
  Box,
  Dropdown,
  listItemSelectBuilder,
} from '@wix/design-system';
import {
  isManifestSupportedByHost,
  versionLabel,
} from '../../../../scripts/manifests/manifest-utils/manifest-utils.js';
import { versionKey } from '../../../../scripts/manifests/manifest-versions/manifest-versions.js';
import type { Manifest } from '../../../../types/app.js';

interface VersionDropdownProps {
  disabled: boolean;
  selectedId: string;
  versions: Manifest[];
  hostId: string;
  deployedManifest?: Manifest;
  onChange: (value: string) => void;
}

export function OverrideVersionDropdown({
  disabled,
  selectedId,
  versions,
  hostId,
  deployedManifest,
  onChange,
}: VersionDropdownProps) {
  const options = versions.map((version) =>
    listItemSelectBuilder({
      id: versionKey(version),
      title: versionLabel(version),
      suffix: isDeployedProductionVersion(version, deployedManifest) && (
        <Badge size="tiny" skin="neutralSuccess">
          Deployed
        </Badge>
      ),
      disabled: !isManifestSupportedByHost(version, hostId),
    }),
  );

  return (
    <Box direction="vertical">
      <Dropdown
        size="small"
        options={options}
        selectedId={selectedId}
        defaultValue={selectedId}
        placeholder="No versions found"
        disabled={disabled || versions.length === 0}
        onSelect={(option: { id: string | number }) =>
          onChange(String(option.id))
        }
      />
    </Box>
  );
}

export function isDeployedProductionVersion(
  manifest: Manifest,
  deployedManifest: Manifest | undefined,
): boolean {
  return (
    manifest.channel === 'production' &&
    deployedManifest?.channel === 'production' &&
    versionKey(manifest) === versionKey(deployedManifest)
  );
}
