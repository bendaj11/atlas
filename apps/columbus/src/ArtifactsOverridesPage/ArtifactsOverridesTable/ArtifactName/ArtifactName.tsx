import type { ArtifactProps } from '../../../popup/types';
import { Badge, Box, InfoIcon, Text } from '@wix/design-system';

export const ArtifactName = ({ artifact }: ArtifactProps) => {
  const isHost = artifact.productionManifest.kind === 'host';

  return (
    <Text size="small" weight="bold" skin={isHost ? 'primary' : 'standard'}>
      {artifact.productionManifest.name}

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
                {artifact.productionManifest.id}
              </Text>
            </Box>
          }
        />
      </Box>
    </Text>
  );
};
