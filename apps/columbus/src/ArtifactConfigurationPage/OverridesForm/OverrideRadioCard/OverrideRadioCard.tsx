import { Box, Card, Cell, Layout, Radio, Text } from '@wix/design-system';
import React, { type ReactNode } from 'react';
import { EditorDraft } from '../../../popup/types';
import './OverrideRadioCard.css';

interface OverrideRadioCardProps {
  children: ReactNode;
  disabled: boolean;
  title: string;
  currentSelectedType: EditorDraft['type'];
  type: EditorDraft['type'];
  onSelect: () => void;
}

export const OverrideRadioCard = ({
  type,
  title,
  disabled,
  children,
  onSelect,
  currentSelectedType,
}: OverrideRadioCardProps) => {
  return (
    <Card>
      <Box padding="SP3">
        <Radio
          className="overrideRadioCard"
          disabled={disabled}
          checked={currentSelectedType === type}
          onChange={() => onSelect()}
          label={
            <Layout alignItems="center">
              <Cell span={3}>
                <Text size="small" weight="bold">
                  {title}
                </Text>
              </Cell>

              <Cell span={9}>{children}</Cell>
            </Layout>
          }
        />
      </Box>
    </Card>
  );
};
