import type { ArtifactTableRow } from '../../../../types/artifact';
import { Badge, Box, InfoIcon, Text } from '@wix/design-system';

export const ArtifactName = ({ artifact }: { artifact: ArtifactTableRow }) => {
  const isHost = artifact.deployedArtifactVersion.kind === 'host';

  return (
    <Box verticalAlign="middle">
      <Text
        dataHook="artifact-name"
        size="small"
        weight="bold"
        skin={isHost ? 'primary' : 'standard'}
      >
        {artifact.deployedArtifactVersion.name}
      </Text>

      <Box inline paddingLeft="SP1">
        <InfoIcon
          dataHook="artifact-info"
          size="small"
          tooltipProps={{ size: 'small', maxWidth: 400 }}
          content={
            <Box direction="vertical" gap="SP1" padding="SP1">
              <Text size="tiny" weight="bold" light>
                Artifact ID
                {isHost && (
                  <Box inline paddingLeft="SP1">
                    <Badge size="tiny" skin="standard">
                      Host
                    </Badge>
                  </Box>
                )}
              </Text>
              <Text size="tiny" secondary light>
                {artifact.deployedArtifactVersion.id}
              </Text>
            </Box>
          }
        />
      </Box>
    </Box>
  );
};
