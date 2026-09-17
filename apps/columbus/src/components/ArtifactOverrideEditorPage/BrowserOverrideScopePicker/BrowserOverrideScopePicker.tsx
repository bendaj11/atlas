import { Box, Card, RadioGroup, Text } from '@wix/design-system';
import type { Scope } from '../../../types/columbus-state';

interface ScopePickerProps {
  selectedScope: Scope;
  disabled: boolean;
  onChange: (value: Scope) => void;
}

export function BrowserOverrideScopePicker({
  selectedScope,
  disabled,
  onChange,
}: ScopePickerProps) {
  return (
    <Card>
      <Box verticalAlign="middle" gap="SP3" padding="SP2 SP3">
        <Text size="small" weight="bold">
          Apply to
        </Text>

        <RadioGroup
          dataHook="override-scope"
          value={selectedScope}
          size="small"
          disabled={disabled}
          display="horizontal"
          onChange={(nextValue) => onChange(nextValue as Scope)}
        >
          <RadioGroup.Radio value="all">All tabs</RadioGroup.Radio>

          <RadioGroup.Radio value="tab">This tab</RadioGroup.Radio>
        </RadioGroup>
      </Box>
    </Card>
  );
}
