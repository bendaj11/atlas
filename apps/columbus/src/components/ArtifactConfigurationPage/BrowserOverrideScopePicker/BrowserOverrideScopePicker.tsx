import React from 'react';
import { Box, Card, RadioGroup, Text } from '@wix/design-system';
import type { Scope } from '../../../types/app.js';

interface ScopePickerProps {
  value: Scope;
  disabled: boolean;
  onChange: (value: Scope) => void;
}

export function BrowserOverrideScopePicker({
  value,
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
          value={value}
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
