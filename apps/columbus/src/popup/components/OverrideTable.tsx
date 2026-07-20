import { useState } from 'react';
import {
  Badge,
  Card,
  Search,
  Table,
  TableActionCell,
  type TableColumn,
  TableToolbar,
  Text,
  ToggleSwitch,
} from '@wix/design-system';
import { artifactKey } from '../../contracts.js';
import { badgeSkin } from '../manifest-utils.js';
import type { AppViewModel, OverrideType } from '../types.js';
import { usePopupHost } from '../../context/PopupHostContext';
import { usePopupNavigation } from '../../context/PopupNavigationContext';
import { usePopupOverrides } from '../../context/PopupOverridesContext';
import { Delete, Edit } from '@wix/wix-ui-icons-common';

export function OverrideTable() {
  const { status } = usePopupHost();
  const { showArtifactConfiguration } = usePopupNavigation();
  const {
    apps,
    clearOverride,
    host,
    status: overrideStatus,
    toggleOverride,
    widgetProviders,
  } = usePopupOverrides();
  const actionsDisabled = status === 'LOADING' || overrideStatus === 'APPLYING';
  const artifacts = [...(host ? [host] : []), ...apps, ...widgetProviders];
  const [searchValue, setSearchValue] = useState('');
  const filteredArtifacts = filterArtifacts(artifacts, searchValue);
  const columns: TableColumn<AppViewModel>[] = [
    {
      title: '',
      width: '5%',
      render: (artifact) => {
        const key = artifactKey(artifact.production);
        const toggleLabel = `${artifact.overrideEnabled ? 'Disable' : 'Enable'} ${artifact.production.name} override`;
        return (
          <ToggleSwitch
            size="small"
            checked={artifact.overrideEnabled}
            disabled={actionsDisabled || !artifact.canToggle}
            onChange={() => void toggleOverride(key)}
            aria-label={toggleLabel}
          />
        );
      },
    },
    {
      title: 'Name',
      width: '10%',
      render: (artifact) => (
        <Text size="small" weight="bold">
          {artifact.production.name}
        </Text>
      ),
    },
    {
      title: 'Current Override',
      width: '30%',
      render: (artifact) => artifact.sourceDescription,
    },
    {
      title: 'Type',
      width: '5%',
      render: (artifact) =>
        artifact.overrideType === 'none' ? null : (
          <Badge size="tiny" skin={badgeSkin(artifact.overrideType)}>
            {tableTypeLabel(artifact.overrideType)}
          </Badge>
        ),
    },
    {
      title: 'Actions',
      align: 'end',
      stickyActionCell: true,
      render: (artifact) => {
        const key = artifactKey(artifact.production);
        return (
          <TableActionCell
            size="small"
            primaryAction={{
              text: 'Edit',
              prefixIcon: <Edit />,
              disabled: actionsDisabled,
              onClick: () => showArtifactConfiguration(key),
            }}
            secondaryActions={[
              {
                text: 'Clear',
                icon: <Delete />,
                skin: 'destructive',
                disabled: actionsDisabled || !artifact.canToggle,
                onClick: () => void clearOverride(key),
              },
            ]}
          />
        );
      },
    },
  ];

  return (
    <Card hideOverflow>
      <Table
        data={filteredArtifacts}
        columns={columns}
        rowVerticalPadding="tiny"
        showHeaderWhenEmpty
      >
        <TableToolbar>
          <TableToolbar.ItemGroup position="start">
            <TableToolbar.Item>
              <TableToolbar.Label>
                {filteredArtifacts.length} artifacts found
              </TableToolbar.Label>
            </TableToolbar.Item>
          </TableToolbar.ItemGroup>

          <TableToolbar.ItemGroup position="end">
            <TableToolbar.Item>
              <Search
                size="small"
                onChange={(event) => setSearchValue(event.target.value)}
              />
            </TableToolbar.Item>
          </TableToolbar.ItemGroup>
        </TableToolbar>

        <Table.Content />
      </Table>
    </Card>
  );
}

function filterArtifacts(
  artifacts: AppViewModel[],
  searchValue: string,
): AppViewModel[] {
  const query = searchValue.trim().toLocaleLowerCase();
  if (!query) return artifacts;

  return artifacts.filter((artifact) =>
    [
      artifact.production.name,
      artifact.sourceDescription,
      tableTypeLabel(artifact.overrideType),
    ].some((value) => value.toLocaleLowerCase().includes(query)),
  );
}

function tableTypeLabel(type: OverrideType): string {
  if (type === 'none') return '';
  if (type === 'custom') return 'LOCAL';
  return type.toLocaleUpperCase();
}
