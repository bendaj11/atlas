import { OverrideRadioCard } from './OverrideRadioCard/OverrideRadioCard';
import type {
  ArtifactConfiguration,
  OverrideSelection,
} from '../../../types/app';
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
          selectedId={selection.type === 'production' ? selection.value : ''}
          versions={configuration.productionArtifactVersions}
          hostId={configuration.hostId}
          deployedArtifactVersion={configuration.productionArtifactVersion}
          onChange={(value) => onChange({ type: 'production', value })}
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
          selectedId={selection.type === 'pr' ? selection.value : ''}
          hostId={configuration.hostId}
          versions={configuration.prArtifactVersions}
          onChange={(value) => onChange({ type: 'pr', value })}
        />
      </OverrideRadioCard>
    </Box>
  );
};
