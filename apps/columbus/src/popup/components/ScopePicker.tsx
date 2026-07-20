import React from 'react';
import { Box, Card, RadioGroup, Text } from '@wix/design-system';
import type { Scope } from '../types.js';

interface ScopePickerProps {
  value: Scope;
  disabled: boolean;
  onChange: (value: Scope) => void;
}

export function ScopePicker({ value, disabled, onChange }: ScopePickerProps) {
  return (
    <Card className="scope-card">
      <Card.Content>
        <Box verticalAlign="middle" gap="12px">
          <Text weight="bold">Apply to</Text>
          <RadioGroup
            value={value}
            disabled={disabled}
            display="horizontal"
            onChange={(nextValue) => onChange(nextValue as Scope)}
          >
            <RadioGroup.Radio value="all">All tabs</RadioGroup.Radio>
            <RadioGroup.Radio value="tab">This tab</RadioGroup.Radio>
          </RadioGroup>
        </Box>
      </Card.Content>
    </Card>
  );
}
