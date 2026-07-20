import React from 'react';
import { Box, Card, Text } from '@wix/design-system';

interface EmptyFrameProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function EmptyFrame({ title, message, action }: EmptyFrameProps) {
  return (
    <Card>
      <Card.Content>
        <Box role="status" verticalAlign="middle" gap="12px">
          <Box direction="vertical" gap="6px" flex="1" minWidth="0">
            <Text weight="bold">{title}</Text>
            <Text size="small" secondary>
              {message}
            </Text>
          </Box>
          {action}
        </Box>
      </Card.Content>
    </Card>
  );
}
