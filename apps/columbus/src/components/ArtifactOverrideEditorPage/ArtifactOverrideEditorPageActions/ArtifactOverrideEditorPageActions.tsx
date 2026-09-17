import { Box, Button, IconButton } from '@wix/design-system';
import { Delete } from '@wix/wix-ui-icons-common';

interface ArtifactOverrideEditorPageActionsProps {
  onSave: () => void;
  onClear: () => void;
  onCancel: () => void;
  saveDisabled: boolean;
  clearDisabled: boolean;
  cancelDisabled: boolean;
}

export const ArtifactOverrideEditorPageActions = ({
  onSave,
  onClear,
  onCancel,
  clearDisabled,
  saveDisabled,
  cancelDisabled,
}: ArtifactOverrideEditorPageActionsProps) => {
  return (
    <Box gap="SP2">
      <IconButton
        dataHook="clear-override"
        ariaLabel="Clear override"
        size="small"
        skin="destructive"
        priority="secondary"
        onClick={onClear}
        disabled={clearDisabled}
      >
        <Delete />
      </IconButton>

      <Button
        dataHook="cancel-overrideOptions"
        size="small"
        onClick={onCancel}
        priority="secondary"
        disabled={cancelDisabled}
      >
        Cancel
      </Button>

      <Button
        dataHook="save-overrideOptions"
        size="small"
        onClick={onSave}
        disabled={saveDisabled}
      >
        Save
      </Button>
    </Box>
  );
};
