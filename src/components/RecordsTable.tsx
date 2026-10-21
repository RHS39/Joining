import { ArrowDown, ArrowUp, ArrowUpDown, Eye, Image as ImageIcon, Pencil, Printer, Trash2 } from 'lucide-react';
import { useObjectUrl } from '@/hooks/useImages';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { cx } from '@/lib/cx';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import type { DataRecord, ImageAttachment, SortKey } from '@/types';

interface RecordsTableProps {
  records: DataRecord[];
  totalCount: number;
  filteredCount: number;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onView: (record: DataRecord) => void;
  onEdit: (record: DataRecord) => void;
  onDelete: (record: DataRecord) => void;
  /** Print the details of a single employee. */
  onPrint: (record: DataRecord) => void;
  images: Map<string, ImageAttachment>;
  currency: string;
  hasFilters: boolean;
  onClearFilters: () => void;
  /** Hide the quantity, unit price and total columns. */
  showQuantities?: boolean;
}

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'recordId', label: 'Employee ID' },
  { key: 'date', label: 'Date of Joining' },
  { key: 'title', label: 'Employee Name' },
  { key: 'category', label: 'Category' },
  { key: 'quantity', label: 'Qty', className: 'text-right' },
  { key: 'unitPrice', label: 'Unit price', className: 'text-right' },
  { key: 'totalAmount', label: 'Total', className: 'text-right' },
];

/** Columns that only make sense for records with a quantity and a price. */
const QUANTITY_KEYS: SortKey[] = ['quantity', 'unitPrice', 'totalAmount'];

function Thumbnail({ attachment, alt }: { attachment?: ImageAttachment; alt: string }) {
  const url = useObjectUrl(attachment?.blob);
  if (!url) {
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded border border-ink-200 bg-ink-50 text-ink-300">
        <ImageIcon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  return <img src={url} alt={alt} className="h-9 w-9 rounded border border-ink-200 bg-ink-50 object-contain" />;
}

function SortIcon({ active, direction }: { active: boolean; direction: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 text-ink-300" aria-hidden="true" />;
  return direction === 'asc' ? (
    <ArrowUp className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
  );
}

export function RecordsTable({
  records,
  totalCount,
  filteredCount,
  sortKey,
  sortDirection,
  onSort,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onView,
  onEdit,
  onDelete,
  onPrint,
  images,
  currency,
  hasFilters,
  onClearFilters,
  showQuantities = true,
}: RecordsTableProps) {
  const allOnPageSelected = records.length > 0 && records.every((record) => selected.has(record.id));
  const columns = showQuantities ? COLUMNS : COLUMNS.filter((column) => !QUANTITY_KEYS.includes(column.key));

  if (records.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon className="h-6 w-6" />}
        title={hasFilters ? 'No employees match the current filters' : 'No employees yet'}
        description={
          hasFilters
            ? 'Try a different search term, category or date range.'
            : 'Employees you add will appear here and can be exported, imported and printed.'
        }
        action={
          hasFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink-200 bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
              <th scope="col" className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                  checked={allOnPageSelected}
                  onChange={onToggleSelectAll}
                  aria-label={allOnPageSelected ? 'Clear selection on this page' : 'Select all employees on this page'}
                />
              </th>
              <th scope="col" className="w-12 px-3 py-2">
                <span className="sr-only">Photo</span>
              </th>
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cx('px-3 py-2 font-medium', column.className)}>
                  <button
                    type="button"
                    onClick={() => onSort(column.key)}
                    className="inline-flex items-center gap-1.5 uppercase tracking-wide hover:text-ink-800"
                  >
                    {column.label}
                    <SortIcon active={sortKey === column.key} direction={sortDirection} />
                  </button>
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {records.map((record) => (
              <tr key={record.id} className={cx('hover:bg-ink-50', selected.has(record.id) && 'bg-brand-50/60')}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    checked={selected.has(record.id)}
                    onChange={() => onToggleSelect(record.id)}
                    aria-label={`Select ${record.title}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <Thumbnail attachment={images.get(record.id)} alt={`Photo of ${record.title}`} />
                </td>
                {columns.map((column) => {
                  let content: React.ReactNode;
                  switch (column.key) {
                    case 'recordId':
                      content = <span className="font-mono text-xs text-ink-700">{record.recordId}</span>;
                      break;
                    case 'date':
                      content = <span className="whitespace-nowrap">{formatDate(record.date)}</span>;
                      break;
                    case 'title':
                      content = <span className="font-medium text-ink-900">{record.title}</span>;
                      break;
                    case 'category':
                      content = <Badge tone="brand">{record.category}</Badge>;
                      break;
                    case 'quantity':
                      content = record.quantity === null ? '—' : formatNumber(record.quantity, 2);
                      break;
                    case 'unitPrice':
                      content = record.unitPrice === null ? '—' : formatCurrency(record.unitPrice, currency);
                      break;
                    default:
                      content = record.totalAmount === null ? '—' : formatCurrency(record.totalAmount, currency);
                  }
                  return (
                    <td key={column.key} className={cx('px-3 py-2 text-ink-700', column.className)}>
                      {content}
                    </td>
                  );
                })}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView(record)} aria-label={`View ${record.title}`}>
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPrint(record)}
                      aria-label={`Print the details of ${record.title}`}
                    >
                      <Printer className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onEdit(record)} aria-label={`Edit ${record.title}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => onDelete(record)}
                      aria-label={`Delete ${record.title}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {records.map((record) => (
          <li key={record.id} className="card-surface p-3">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={selected.has(record.id)}
                onChange={() => onToggleSelect(record.id)}
                aria-label={`Select ${record.title}`}
              />
              <Thumbnail attachment={images.get(record.id)} alt={`Photo of ${record.title}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-900">{record.title}</p>
                <p className="mt-0.5 font-mono text-xs text-ink-500">{record.recordId}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-600">
                  <Badge tone="brand">{record.category}</Badge>
                  <span>{formatDate(record.date)}</span>
                  {record.totalAmount !== null ? <span>{formatCurrency(record.totalAmount, currency)}</span> : null}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2 border-t border-ink-100 pt-2">
              <Button variant="outline" size="sm" onClick={() => onView(record)} icon={<Eye className="h-4 w-4" />}>
                View
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPrint(record)} icon={<Printer className="h-4 w-4" />}>
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={() => onEdit(record)} icon={<Pencil className="h-4 w-4" />}>
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600"
                onClick={() => onDelete(record)}
                icon={<Trash2 className="h-4 w-4" />}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-3 text-sm text-ink-600">
        <p>
          Showing <span className="font-medium text-ink-900">{records.length}</span> of{' '}
          <span className="font-medium text-ink-900">{filteredCount}</span> filtered employees
          {filteredCount !== totalCount ? <span className="text-ink-500"> (from {totalCount} in total)</span> : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <span>Rows</span>
            <select
              className="field-input h-9 w-20 py-1"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Previous page"
            >
              Prev
            </Button>
            <span className="px-2 text-sm text-ink-600">
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              aria-label="Next page"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
