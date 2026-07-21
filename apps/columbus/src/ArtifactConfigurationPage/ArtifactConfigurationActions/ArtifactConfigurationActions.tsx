import { Box, Button, IconButton } from '@wix/design-system';
import { Delete } from '@wix/wix-ui-icons-common';

interface ArtifactConfigurationActionsProps {
  onSave: () => void;
  onClear: () => void;
  onCancel: () => void;
  saveDisabled: boolean;
  clearDisabled: boolean;
  cancelDisabled: boolean;
}

export const ArtifactConfigurationActions = ({
  onSave,
  onClear,
  onCancel,
  clearDisabled,
  saveDisabled,
  cancelDisabled,
}: ArtifactConfigurationActionsProps) => {
  return (
    <Box gap="SP2">
      <IconButton
        aria-label="Clear override"
        size="small"
        skin="destructive"
        priority="secondary"
        onClick={onClear}
        disabled={clearDisabled}
      >
        <Delete />
      </IconButton>

      <Button
        size="small"
        onClick={onCancel}
        priority="secondary"
        disabled={cancelDisabled}
      >
        Cancel
      </Button>

      <Button size="small" onClick={onSave} disabled={saveDisabled}>
        Save
      </Button>
    </Box>
  );
};
