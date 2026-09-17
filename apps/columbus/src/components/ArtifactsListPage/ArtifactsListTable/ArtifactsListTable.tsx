import { Card, Table, type TableColumn } from '@wix/design-system';
import type { ArtifactTableRow } from '../../../types/artifact';
import { ArtifactOverrideToggle } from './ArtifactOverrideToggle/ArtifactOverrideToggle';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion/ArtifactOverrideVersion';
import { ArtifactOverrideActions } from './ArtifactOverrideActions/ArtifactOverrideActions';
import { ArtifactsListTableToolbar } from './ArtifactsListTableToolbar/ArtifactsListTableToolbar';
import { useArtifacts } from '../useArtifacts/useArtifacts';
import { ArtifactName } from './ArtifactName/ArtifactName';

export function ArtifactsListTable() {
  const { artifacts, totalCount, setSearchValue, visibleOnly, setVisibleOnly } =
    useArtifacts();

  const columns: TableColumn<ArtifactTableRow>[] = [
    {
      title: '',
      align: 'start',
      width: '20px',
      render: (artifact) =>
        artifact.canToggle ? (
          <ArtifactOverrideToggle artifact={artifact} />
        ) : null,
    },
    {
      title: 'Name',
      render: (artifact) => <ArtifactName artifact={artifact} />,
    },
    {
      title: 'Version',
      align: 'center',
      render: (artifact) => <ArtifactOverrideVersion artifact={artifact} />,
    },
    {
      title: '',
      render: (artifact) => <ArtifactOverrideActions artifact={artifact} />,
    },
  ];

  return (
    <Card hideOverflow>
      <Table
        dataHook="artifacts-table"
        columns={columns}
        showHeaderWhenEmpty
        data={artifacts}
        rowVerticalPadding="large"
      >
        <ArtifactsListTableToolbar
          onSearch={setSearchValue}
          totalCount={totalCount}
          filteredCount={artifacts.length}
          visibleOnly={visibleOnly}
          onVisibleOnlyChange={setVisibleOnly}
        />

        <Table.Content titleBarVisible={false} />
      </Table>
    </Card>
  );
}
