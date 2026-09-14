import { Card, Table, type TableColumn } from '@wix/design-system';
import type { Artifact } from '../../../types/app';
import { ArtifactOverrideToggle } from './ArtifactOverrideToggle/ArtifactOverrideToggle';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion/ArtifactOverrideVersion';
import { ArtifactOverrideActions } from './ArtifactOverrideActions/ArtifactOverrideActions';
import { OverridesTableToolbar } from './OverridesTableToolbar/OverridesTableToolbar';
import { useArtifacts } from '../useArtifacts/useArtifacts';
import { ArtifactName } from './ArtifactName/ArtifactName';

export function ArtifactsOverridesTable() {
  const { artifacts, totalCount, setSearchValue, visibleOnly, setVisibleOnly } =
    useArtifacts();

  const columns: TableColumn<Artifact>[] = [
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
        columns={columns}
        showHeaderWhenEmpty
        data={artifacts}
        rowVerticalPadding="large"
      >
        <OverridesTableToolbar
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
