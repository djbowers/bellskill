import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { Loading } from '~/components';

import { Button } from './button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  currentPage: number;
  data: TData[];
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  isLoading?: boolean;
  onClickFirstPage?: () => void;
  onClickLastPage?: () => void;
  onClickNextPage?: () => void;
  onClickPreviousPage?: () => void;
  onSort?: (columnId: string) => void;
  order?: 'ASC' | 'DESC';
  orderBy?: string;
  pageSize: number;
  rowCount: number;
}

export function DataTable<TData, TValue>({
  columns,
  currentPage = 1,
  data,
  hasNextPage,
  hasPreviousPage,
  isLoading = false,
  onClickFirstPage,
  onClickLastPage,
  onClickNextPage,
  onClickPreviousPage,
  onSort,
  order,
  orderBy,
  pageSize = 10,
  rowCount,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount,
  });

  const handleHeaderClick = (columnId: string) => {
    if (!onSort) return;
    onSort(columnId);
  };

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const columnId = header.column.id;
                const isSorted = orderBy === columnId;
                const sortDirection = isSorted ? order : undefined;

                return (
                  <TableHead
                    key={header.id}
                    className={onSort ? 'cursor-pointer select-none' : ''}
                    onClick={() => handleHeaderClick(columnId)}
                  >
                    <div className="flex items-center gap-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {isSorted && (
                        <span className="text-muted-foreground">
                          {sortDirection === 'ASC' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                <div className="flex justify-center">
                  <Loading />
                </div>
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && 'selected'}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DataTablePagination
        currentPage={currentPage}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        isLoading={isLoading}
        onClickFirstPage={onClickFirstPage}
        onClickLastPage={onClickLastPage}
        onClickNextPage={onClickNextPage}
        onClickPreviousPage={onClickPreviousPage}
        pageSize={pageSize}
        rowCount={rowCount}
      />
    </div>
  );
}

interface DataTablePaginationProps {
  currentPage: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  isLoading?: boolean;
  onClickFirstPage?: () => void;
  onClickLastPage?: () => void;
  onClickNextPage?: () => void;
  onClickPreviousPage?: () => void;
  pageSize: number;
  rowCount: number;
}

export function DataTablePagination({
  currentPage,
  hasNextPage,
  hasPreviousPage,
  isLoading = false,
  onClickFirstPage,
  onClickLastPage,
  onClickNextPage,
  onClickPreviousPage,
  pageSize,
  rowCount,
}: DataTablePaginationProps) {
  const totalPages = Math.ceil(rowCount / pageSize);

  return (
    <div className="flex items-center justify-between py-4">
      <div className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages} • {rowCount} total items
      </div>
      <div className="flex items-center space-x-2">
        {onClickFirstPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClickFirstPage}
            disabled={!hasPreviousPage || isLoading}
          >
            First
          </Button>
        )}
        {onClickPreviousPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClickPreviousPage}
            disabled={!hasPreviousPage || isLoading}
          >
            Previous
          </Button>
        )}
        {onClickNextPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClickNextPage}
            disabled={!hasNextPage || isLoading}
          >
            Next
          </Button>
        )}
        {onClickLastPage && (
          <Button
            variant="outline"
            size="sm"
            onClick={onClickLastPage}
            disabled={!hasNextPage || isLoading}
          >
            Last
          </Button>
        )}
      </div>
    </div>
  );
}
