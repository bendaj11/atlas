import { OverrideRadioCard } from './OverrideRadioCard/OverrideRadioCard';
import { type ArtifactConfiguration, EditorDraft } from '../../../types/app.js';
import { Box, Input } from '@wix/design-system';
import { OverrideVersionDropdown } from './OverrideVersionDropdown/OverrideVersionDropdown';

interface OverridesSelectionFormProps {
  draft: EditorDraft;
  configuration: ArtifactConfiguration;
  onDraftChange: (draft: Partial<EditorDraft>) => void;
}

export const OverridesSelectionForm = ({
  draft,
  onDraftChange,
  configuration,
}: OverridesSelectionFormProps) => {
  return (
    <Box direction="vertical" gap="SP2">
      <OverrideRadioCard
        type="custom"
        title="Custom URL"
        currentSelectedType={draft.type}
        disabled={false}
        onSelect={() => onDraftChange({ type: 'custom' })}
      >
        <Input
          size="small"
          value={draft.customUrl}
          disabled={draft.type !== 'custom'}
          placeholder="http://localhost:4200"
          onChange={(event) => onDraftChange({ customUrl: event.target.value })}
        />
      </OverrideRadioCard>

      <OverrideRadioCard
        type="production"
        title="Production"
        currentSelectedType={draft.type}
        disabled={configuration.productionOptions.length === 0}
        onSelect={() => onDraftChange({ type: 'production' })}
      >
        <OverrideVersionDropdown
          disabled={draft.type !== 'production'}
          selectedId={draft.productionKey}
          versions={configuration.productionOptions}
          hostId={configuration.hostId}
          deployedManifest={configuration.productionManifest}
          onChange={(productionKey) => onDraftChange({ productionKey })}
        />
      </OverrideRadioCard>

      <OverrideRadioCard
        disabled={configuration.prOptions.length === 0}
        title="PR Preview"
        currentSelectedType={draft.type}
        type="pr"
        onSelect={() => onDraftChange({ type: 'pr' })}
      >
        <OverrideVersionDropdown
          disabled={draft.type !== 'pr'}
          selectedId={draft.prKey}
          hostId={configuration.hostId}
          versions={configuration.prOptions}
          onChange={(prKey) => onDraftChange({ prKey })}
        />
      </OverrideRadioCard>
    </Box>
  );
};
