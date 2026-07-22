import { useState } from 'react';
import { Card, Table, type TableColumn } from '@wix/design-system';
import type { Artifact } from '../../../types/app.js';
import { ArtifactOverrideToggle } from './ArtifactOverrideToggle/ArtifactOverrideToggle';
import { ArtifactOverrideVersion } from './ArtifactOverrideVersion/ArtifactOverrideVersion';
import { ArtifactOverrideActions } from './ArtifactOverrideActions/ArtifactOverrideActions';
import { OverridesTableToolbar } from './OverridesTableToolbar/OverridesTableToolbar';
import { useArtifacts } from '../useArtifacts/useArtifacts';
import { ArtifactName } from './ArtifactName/ArtifactName';

export function ArtifactsOverridesTable() {
  const artifacts = useArtifacts();
  const [searchValue, setSearchValue] = useState('');
  const searchQuery = searchValue.trim().toLocaleLowerCase();
  const filteredArtifacts = searchQuery
    ? artifacts.filter((artifact) =>
        [artifact.productionManifest.name, artifact.sourceDescription].some(
          (value) => value.toLocaleLowerCase().includes(searchQuery),
        ),
      )
    : artifacts;
  const sortedArtifacts = [...filteredArtifacts].sort(
    (left, right) =>
      Number(right.overrideEnabled) - Number(left.overrideEnabled) ||
      Number(right.canToggle) - Number(left.canToggle),
  );

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
        data={sortedArtifacts}
        rowVerticalPadding="large"
      >
        <OverridesTableToolbar
          onSearch={setSearchValue}
          totalCount={artifacts.length}
          filteredCount={filteredArtifacts.length}
        />

        <Table.Content titleBarVisible={false} />
      </Table>
    </Card>
  );
}
