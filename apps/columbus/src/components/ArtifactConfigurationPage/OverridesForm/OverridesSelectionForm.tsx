import { OverrideRadioCard } from './OverrideRadioCard/OverrideRadioCard';
import type {
  ArtifactConfiguration,
  OverrideSelection,
} from '../../../types/artifact';
import { Box, Input } from '@wix/design-system';
import { OverrideVersionDropdown } from './OverrideVersionDropdown/OverrideVersionDropdown';

interface OverridesSelectionFormProps {
  selection: OverrideSelection;
  configuration: ArtifactConfiguration;
  onChange: (selection: OverrideSelection) => void;
}

export const OverridesSelectionForm = ({
  selection,
  onChange,
  configuration,
}: OverridesSelectionFormProps) => {
  return (
    <Box direction="vertical" gap="SP2">
      <OverrideRadioCard
        dataHook="override-card-custom"
        title="Custom URL"
        checked={selection.type === 'custom'}
        disabled={false}
        onSelect={() => onChange({ type: 'custom', value: '' })}
      >
        <Input
          dataHook="override-custom-url"
          size="small"
          value={selection.type === 'custom' ? selection.value : ''}
          disabled={selection.type !== 'custom'}
          placeholder="http://localhost:4200"
          onChange={(event) =>
            onChange({ type: 'custom', value: event.target.value })
          }
        />
      </OverrideRadioCard>

      <OverrideRadioCard
        dataHook="override-card-production"
        title="Production"
        checked={selection.type === 'production'}
        disabled={configuration.productionArtifactVersions.length === 0}
        onSelect={() => onChange({ type: 'production', value: '' })}
      >
        <OverrideVersionDropdown
          dataHook="override-version-production"
          disabled={selection.type !== 'production'}
          selectedArtifactVersionKey={
            selection.type === 'production' ? selection.value : ''
          }
          artifactVersions={configuration.productionArtifactVersions}
          hostId={configuration.hostId}
          deployedArtifactVersion={configuration.productionArtifactVersion}
          onChange={(artifactVersionKey) =>
            onChange({ type: 'production', value: artifactVersionKey })
          }
        />
      </OverrideRadioCard>

      <OverrideRadioCard
        dataHook="override-card-pr"
        disabled={configuration.prArtifactVersions.length === 0}
        title="PR Preview"
        checked={selection.type === 'pr'}
        onSelect={() => onChange({ type: 'pr', value: '' })}
      >
        <OverrideVersionDropdown
          dataHook="override-version-pr"
          disabled={selection.type !== 'pr'}
          selectedArtifactVersionKey={
            selection.type === 'pr' ? selection.value : ''
          }
          hostId={configuration.hostId}
          artifactVersions={configuration.prArtifactVersions}
          onChange={(artifactVersionKey) =>
            onChange({ type: 'pr', value: artifactVersionKey })
          }
        />
      </OverrideRadioCard>
    </Box>
  );
};
