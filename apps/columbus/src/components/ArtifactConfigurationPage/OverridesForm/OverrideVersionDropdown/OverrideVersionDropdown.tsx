import {
  Badge,
  Box,
  Dropdown,
  listItemSelectBuilder,
} from '@wix/design-system';
import {
  isDeployedProductionVersion,
  isArtifactVersionSupportedByHost,
  versionLabel,
} from '../../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import { versionKey } from '../../../../scripts/artifact-versions/artifact-version-keys/artifact-version-keys';
import type { ArtifactVersion } from '../../../../types/artifact-version';

interface VersionDropdownProps {
  dataHook: string;
  disabled: boolean;
  selectedId: string;
  versions: ArtifactVersion[];
  hostId: string;
  deployedArtifactVersion?: ArtifactVersion;
  onChange: (value: string) => void;
}

export function OverrideVersionDropdown({
  dataHook,
  disabled,
  selectedId,
  versions,
  hostId,
  deployedArtifactVersion,
  onChange,
}: VersionDropdownProps) {
  const options = versions.map((version) =>
    listItemSelectBuilder({
      id: versionKey(version),
      title: versionLabel(version),
      suffix: isDeployedProductionVersion(version, deployedArtifactVersion) && (
        <Badge size="tiny" skin="neutralSuccess">
          Deployed
        </Badge>
      ),
      disabled: !isArtifactVersionSupportedByHost({
        artifactVersion: version,
        hostId,
      }),
    }),
  );

  return (
    <Box direction="vertical">
      <Dropdown
        dataHook={dataHook}
        size="small"
        options={options}
        selectedId={selectedId}
        placeholder="Choose a version"
        disabled={disabled || versions.length === 0}
        onSelect={(option) => onChange(String(option.id))}
      />
    </Box>
  );
}
