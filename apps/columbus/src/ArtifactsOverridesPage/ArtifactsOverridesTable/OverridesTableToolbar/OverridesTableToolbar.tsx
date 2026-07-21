import { Search, TableToolbar } from '@wix/design-system';

interface OverridesTableToolbarProps {
  onSearch: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

export const OverridesTableToolbar = ({
  onSearch,
  totalCount,
  filteredCount,
}: OverridesTableToolbarProps) => {
  const count =
    filteredCount !== totalCount
      ? `${filteredCount}/${totalCount}`
      : totalCount;

  return (
    <TableToolbar>
      <TableToolbar.ItemGroup position="start">
        <TableToolbar.Item>
          <TableToolbar.Label>{count} artifacts found</TableToolbar.Label>
        </TableToolbar.Item>
      </TableToolbar.ItemGroup>

      <TableToolbar.ItemGroup position="end">
        <TableToolbar.Item>
          <Search
            size="small"
            onChange={(event) => onSearch(event.target.value)}
          />
        </TableToolbar.Item>
      </TableToolbar.ItemGroup>
    </TableToolbar>
  );
};
