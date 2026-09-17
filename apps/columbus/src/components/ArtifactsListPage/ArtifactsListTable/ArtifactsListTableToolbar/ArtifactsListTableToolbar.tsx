import { IconButton, Search, TableToolbar, Tooltip } from '@wix/design-system';
import { Sparkles, SparklesFilled } from '@wix/wix-ui-icons-common';

interface ArtifactsListTableToolbarProps {
  onSearch: (value: string) => void;
  totalCount: number;
  filteredCount: number;
  visibleOnly: boolean;
  onVisibleOnlyChange: (visibleOnly: boolean) => void;
}

export const ArtifactsListTableToolbar = ({
  onSearch,
  totalCount,
  filteredCount,
  visibleOnly,
  onVisibleOnlyChange,
}: ArtifactsListTableToolbarProps) => {
  const count =
    filteredCount !== totalCount
      ? `${filteredCount}/${totalCount}`
      : totalCount;

  return (
    <TableToolbar>
      <TableToolbar.ItemGroup position="start">
        <TableToolbar.Item>
          <Search
            dataHook="artifacts-search"
            size="small"
            onChange={(event) => onSearch(event.target.value)}
          />
        </TableToolbar.Item>

        <TableToolbar.Item>
          <Tooltip
            size="small"
            placement="top"
            content="Show only visible artifacts"
          >
            <IconButton
              size="small"
              dataHook="visible-artifacts-filter"
              ariaLabel="Show visible artifacts only"
              priority={visibleOnly ? 'primary' : 'secondary'}
              onClick={() => onVisibleOnlyChange(!visibleOnly)}
            >
              {visibleOnly ? <SparklesFilled /> : <Sparkles />}
            </IconButton>
          </Tooltip>
        </TableToolbar.Item>
      </TableToolbar.ItemGroup>

      <TableToolbar.ItemGroup position="end">
        <TableToolbar.Item>
          <TableToolbar.Label dataHook="artifacts-count">
            {count + ' artifacts found'}
          </TableToolbar.Label>
        </TableToolbar.Item>
      </TableToolbar.ItemGroup>
    </TableToolbar>
  );
};
