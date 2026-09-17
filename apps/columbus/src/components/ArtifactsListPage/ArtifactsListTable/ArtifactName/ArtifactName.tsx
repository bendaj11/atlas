import type { Artifact } from '../../../../types/artifact';
import { Badge, Box, InfoIcon, Text } from '@wix/design-system';

export const ArtifactName = ({ artifact }: { artifact: Artifact }) => {
  const isHost = artifact.productionArtifactVersion.kind === 'host';

  return (
    <Text size="small" weight="bold" skin={isHost ? 'primary' : 'standard'}>
      {artifact.productionArtifactVersion.name}

      <Box inline paddingLeft="SP1">
        <InfoIcon
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
                {artifact.productionArtifactVersion.id}
              </Text>
            </Box>
          }
        />
      </Box>
    </Text>
  );
};
