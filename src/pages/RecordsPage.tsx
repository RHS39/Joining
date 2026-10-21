import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, PlusCircle, Printer, Search, Trash2, X } from 'lucide-react';
import { RecordsTable } from '@/components/RecordsTable';
import { RecordDetailsModal } from '@/components/RecordDetailsModal';
import { PrintEmployeeDialog } from '@/components/PrintEmployeeDialog';
import { useRecords } from '@/components/RecordsContext';
import { useSettings } from '@/components/SettingsContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useImagesMap } from '@/hooks/useImages';
import { deleteRecords, sortAndFilter } from '@/db/repository';
import { describeError } from '@/lib/errors';
import { EMPTY_FILTERS, type DataRecord, type RecordFilters, type SortKey } from '@/types';

export default function RecordsPage() {
  const { records, loading, reload } = useRecords();
  const { settings } = useSettings();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<RecordFilters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailRecord, setDetailRecord] = useState<DataRecord | null>(null);
  const [printRecords, setPrintRecords] = useState<DataRecord[] | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DataRecord | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => sortAndFilter(records, filters, sortKey, sortDirection),
    [records, filters, sortKey, sortDirection],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRecords = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const images = useImagesMap(pageRecords.map((record) => record.id));

  const hasFilters = Boolean(filters.search || filters.category || filters.dateFrom || filters.dateTo);

  const updateFilter = <K extends keyof RecordFilters>(key: K, value: RecordFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'date' || key === 'createdAt' ? 'desc' : 'asc');
  };

  const toggleSelect = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((current) => {
      const allSelected = pageRecords.length > 0 && pageRecords.every((record) => current.has(record.id));
      const next = new Set(current);
      pageRecords.forEach((record) => {
        if (allSelected) next.delete(record.id);
        else next.add(record.id);
      });
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteRecords([pendingDelete.id]);
      notify(`Employee ${pendingDelete.recordId} was deleted.`, 'success');
      setPendingDelete(null);
      setDetailRecord(null);
      setSelected((current) => {
        const next = new Set(current);
        next.delete(pendingDelete.id);
        return next;
      });
      await reload();
    } catch (error) {
      notify(describeError(error, 'The employee could not be deleted.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmBulkDelete = async () => {
    setBusy(true);
    try {
      const count = await deleteRecords([...selected]);
      notify(`${count} employee${count === 1 ? '' : 's'} were deleted.`, 'success');
      setSelected(new Set());
      setBulkDeleteOpen(false);
      await reload();
    } catch (error) {
      notify(describeError(error, 'The employees could not be deleted.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  /** Open the print preview for a single employee. */
  const openPrint = (record: DataRecord) => {
    setDetailRecord(null);
    setPrintRecords([record]);
  };

  /** Open the print preview for every selected employee. */
  const openPrintSelected = () => {
    const chosen = records.filter((record) => selected.has(record.id));
    if (chosen.length === 0) {
      notify('Select at least one employee before printing.', 'warning');
      return;
    }
    setPrintRecords(chosen);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Employees</h1>
          <p className="mt-1 text-sm text-ink-500">
            {loading ? 'Loading…' : `${records.length} employee${records.length === 1 ? '' : 's'} stored in this browser.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 ? (
            <>
              <Button variant="outline" onClick={openPrintSelected} icon={<Printer className="h-4 w-4" />}>
                Print {selected.size} selected
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete {selected.size} selected
              </Button>
            </>
          ) : null}
          <Link to="/records/new">
            <Button icon={<PlusCircle className="h-4 w-4" />}>Add employee</Button>
          </Link>
        </div>
      </header>

      <Card>
        <CardHeader
          title="Filters"
          description="Search by Employee ID, name or remarks, and narrow the list by category and date of joining range."
          actions={
            hasFilters ? (
              <Button variant="ghost" size="sm" onClick={clearFilters} icon={<X className="h-4 w-4" />}>
                Clear
              </Button>
            ) : null
          }
        />
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 xl:col-span-2">
              <label htmlFor="records-search" className="block text-sm font-medium text-ink-800">
                Search
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
                  aria-hidden="true"
                />
                <input
                  id="records-search"
                  type="search"
                  className="field-input pl-9"
                  placeholder="Employee ID, name or remarks…"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="records-category" className="block text-sm font-medium text-ink-800">
                Category
              </label>
              <select
                id="records-category"
                className="field-input"
                value={filters.category}
                onChange={(event) => updateFilter('category', event.target.value)}
              >
                <option value="">All categories</option>
                {settings.categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink-800">Date range</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  aria-label="From date"
                  className="field-input"
                  value={filters.dateFrom}
                  onChange={(event) => updateFilter('dateFrom', event.target.value)}
                />
                <span className="text-ink-400">–</span>
                <input
                  type="date"
                  aria-label="To date"
                  className="field-input"
                  value={filters.dateTo}
                  onChange={(event) => updateFilter('dateTo', event.target.value)}
                />
              </div>
            </div>
          </div>

          {hasFilters ? (
            <p className="mt-3 inline-flex items-center gap-2 text-xs text-ink-500">
              <Filter className="h-3.5 w-3.5" aria-hidden="true" />
              {filtered.length} of {records.length} employees match the current filters.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <RecordsTable
            records={pageRecords}
            totalCount={records.length}
            filteredCount={filtered.length}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            page={safePage}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onView={setDetailRecord}
            onEdit={(record) => navigate(`/records/${record.id}/edit`)}
            onDelete={setPendingDelete}
            onPrint={openPrint}
            images={images}
            currency={settings.preferences.currency}
            hasFilters={hasFilters}
            onClearFilters={clearFilters}
            showQuantities={settings.preferences.showQuantities !== false}
          />
        </CardBody>
      </Card>

      <RecordDetailsModal
        record={detailRecord}
        image={detailRecord ? images.get(detailRecord.id) : undefined}
        customFields={settings.customFields}
        currency={settings.preferences.currency}
        showQuantities={settings.preferences.showQuantities !== false}
        onClose={() => setDetailRecord(null)}
        onEdit={(record) => navigate(`/records/${record.id}/edit`)}
        onDelete={(record) => setPendingDelete(record)}
        onPrint={openPrint}
      />

      {printRecords ? (
        <PrintEmployeeDialog
          records={printRecords}
          pageSize={settings.preferences.defaultPageSize}
          orientation="portrait"
          organisation={settings.preferences.organisation}
          onClose={() => setPrintRecords(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete employee"
        destructive
        busy={busy}
        confirmLabel="Delete employee"
        message={
          <>
            <p>
              The employee <strong>{pendingDelete?.title}</strong> ({pendingDelete?.recordId}) and its attached photo will
              be permanently removed from this browser.
            </p>
            <p>This cannot be undone. Export a backup first if you might need the data again.</p>
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Delete ${selected.size} records`}
        destructive
        busy={busy}
        confirmLabel="Delete selected records"
        message={
          <>
            <p>
              {selected.size} selected employee{selected.size === 1 ? '' : 's'} and their attached photos will be
              permanently removed from this browser.
            </p>
            <p>This cannot be undone.</p>
          </>
        }
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => void confirmBulkDelete()}
      />
    </div>
  );
}
