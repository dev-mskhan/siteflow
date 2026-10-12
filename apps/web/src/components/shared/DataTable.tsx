import { type ReactNode, useState, useMemo } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from './EmptyState';
import { Input } from '../ui/Input';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  isNumeric?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchKey?: keyof T;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  searchPlaceholder = 'Search records...',
  searchKey,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display yet.',
  onRowClick,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = useMemo(() => {
    if (!searchTerm || !searchKey) return data;
    return data.filter((row) => {
      const val = (row as Record<string, unknown>)[searchKey as string];
      return String(val ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [data, searchTerm, searchKey]);

  return (
    <div className="flex flex-col gap-4">
      {searchKey && (
        <div className="flex items-center max-w-sm">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className={col.isNumeric ? 'text-right' : 'text-left'}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : filteredData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center p-8">
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </TableCell>
            </TableRow>
          ) : (
            filteredData.map((row, rowIdx) => (
              <TableRow
                key={rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} isNumeric={col.isNumeric}>
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
