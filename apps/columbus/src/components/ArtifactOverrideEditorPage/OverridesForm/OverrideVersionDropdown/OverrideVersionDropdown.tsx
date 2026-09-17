import {
  Badge,
  Box,
  Dropdown,
  listItemSelectBuilder,
} from '@wix/design-system';
import {
  isArtifactVersionSupportedByHost,
  versionLabel,
} from '../../../../scripts/artifact-versions/artifact-version-utils/artifact-version-utils';
import { versionKey } from '../../../../scripts/artifact-versions/artifact-version-keys/artifact-version-keys';
import type { ArtifactVersion } from '../../../../types/artifact-version';

interface OverrideVersionDropdownProps {
  dataHook: string;
  disabled: boolean;
  selectedArtifactVersionKey: string;
  artifactVersions: ArtifactVersion[];
  hostId: string;
  deployedArtifactVersion?: ArtifactVersion | undefined;
  onChange: (artifactVersionKey: string) => void;
}

export function OverrideVersionDropdown({
  dataHook,
  disabled,
  selectedArtifactVersionKey,
  artifactVersions,
  hostId,
  deployedArtifactVersion,
  onChange,
}: OverrideVersionDropdownProps) {
  const hasArtifactVersions = artifactVersions.length > 0;
  const options = artifactVersions.map((artifactVersion) =>
    listItemSelectBuilder({
      id: versionKey(artifactVersion),
      title: versionLabel(artifactVersion),
      suffix: isDeployedProductionVersion(
        artifactVersion,
        deployedArtifactVersion,
      ) && (
        <Badge size="tiny" skin="neutralSuccess">
          Deployed
        </Badge>
      ),
      disabled: !isArtifactVersionSupportedByHost({
        artifactVersion,
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
        selectedId={selectedArtifactVersionKey}
        placeholder={
          hasArtifactVersions ? 'Choose a version' : 'No versions available'
        }
        disabled={disabled || !hasArtifactVersions}
        onSelect={(option) => onChange(String(option.id))}
      />
    </Box>
  );
}

function isDeployedProductionVersion(
  artifactVersion: ArtifactVersion,
  deployedArtifactVersion: ArtifactVersion | undefined,
): boolean {
  return (
    deployedArtifactVersion?.channel === 'production' &&
    versionKey(artifactVersion) === versionKey(deployedArtifactVersion)
  );
}
