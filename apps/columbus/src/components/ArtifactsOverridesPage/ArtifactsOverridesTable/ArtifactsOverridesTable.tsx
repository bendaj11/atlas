import { useState } from 'react';
import { Card, Table, type TableColumn } from '@wix/design-system';
import type { Artifact } from '../../../types/app.js';
import { ArtifactOverrideToggle } from './ArtifactOverrideToggle/ArtifactOverrideToggle.js';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion/ArtifactOverrideVersion.js';
import { ArtifactOverrideActions } from './ArtifactOverrideActions/ArtifactOverrideActions.js';
import { OverridesTableToolbar } from './OverridesTableToolbar/OverridesTableToolbar.js';
import { useArtifacts } from '../useArtifacts/useArtifacts.js';
import { ArtifactName } from './ArtifactName/ArtifactName.js';
import { filterArtifacts } from './filterArtifacts/filterArtifacts.js';

export function ArtifactsOverridesTable() {
  const allArtifacts = useArtifacts();
  const [searchValue, setSearchValue] = useState('');
  const [visibleOnly, setVisibleOnly] = useState(false);
  const { artifacts, totalCount } = filterArtifacts({
    artifacts: allArtifacts,
    searchValue,
    visibleOnly,
  });

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
