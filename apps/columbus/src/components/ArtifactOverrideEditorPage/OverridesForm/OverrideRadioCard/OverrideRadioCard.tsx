import { Box, Card, Cell, Layout, Radio, Text } from '@wix/design-system';
import type { ReactNode } from 'react';
import './OverrideRadioCard.css';

interface OverrideRadioCardProps {
  children: ReactNode;
  dataHook: string;
  disabled: boolean;
  title: string;
  checked: boolean;
  onSelect: () => void;
}

export const OverrideRadioCard = ({
  dataHook,
  title,
  checked,
  disabled,
  children,
  onSelect,
}: OverrideRadioCardProps) => {
  return (
    <Card>
      <Box padding="SP3">
        <Radio
          className="overrideRadioCard"
          dataHook={dataHook}
          disabled={disabled}
          checked={checked}
          onChange={onSelect}
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
