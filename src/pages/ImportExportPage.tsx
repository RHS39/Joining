import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FileUp,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { useRecords } from '@/components/RecordsContext';
import { useSettings } from '@/components/SettingsContext';
import { useToast } from '@/components/ui/Toast';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { applyImportPlan } from '@/db/repository';
import { IMPORTABLE_COLUMNS, getAllColumns, guessColumnForHeader } from '@/lib/columns';
import { createBackup, downloadBackup, parseBackupFile, restoreBackup } from '@/lib/backup';
import { downloadErrorReport, exportRecordsToCsv, exportRecordsToExcel, readSpreadsheet, type ParsedWorkbook } from '@/lib/excel';
import { describeError } from '@/lib/errors';
import { buildImportPlan, IMPORT_STRATEGIES, type ImportMapping, type ImportPlan, type ImportStrategy } from '@/lib/import';
import { sortAndFilter } from '@/db/repository';
import { formatDate, safeFileName } from '@/lib/format';
import { EMPTY_FILTERS, type RecordFilters } from '@/types';

type ExportScope = 'all' | 'filtered';

export default function ImportExportPage() {
  const { records, reload } = useRecords();
  const { settings, reload: reloadSettings } = useSettings();
  const { notify } = useToast();

  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [filters, setFilters] = useState<RecordFilters>(EMPTY_FILTERS);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ inserted: number; updated: number } | null>(null);

  const columns = useMemo(() => getAllColumns(settings.customFields), [settings.customFields]);
  const importableColumns = useMemo(
    () => [...IMPORTABLE_COLUMNS, ...columns.filter((column) => column.key.startsWith('custom:'))],
    [columns],
  );

  const filteredRecords = useMemo(() => sortAndFilter(records, filters, 'date', 'desc'), [records, filters]);
  const exportRecords = exportScope === 'all' ? records : filteredRecords;

  const existingIds = useMemo(() => new Set(records.map((record) => record.recordId)), [records]);

  const plan = useMemo<ImportPlan | null>(() => {
    if (!workbook || !sheetName) return null;
    const sheet = workbook.sheets[sheetName];
    if (!sheet) return null;
    return buildImportPlan({
      mapping,
      headers: sheet.headers,
      rows: sheet.rows,
      rowNumbers: sheet.rowNumbers,
      existingRecordIds: existingIds,
      customFields: settings.customFields,
      strategy,
    });
  }, [workbook, sheetName, mapping, existingIds, settings.customFields, strategy]);

  const autoMap = (book: ParsedWorkbook, name: string) => {
    const sheet = book.sheets[name];
    if (!sheet) return {};
    const used = new Set<string>();
    const result: ImportMapping = {};
    sheet.headers.forEach((header, index) => {
      if (!header.trim()) return;
      const key = guessColumnForHeader(header, importableColumns, used);
      if (key) {
        used.add(key);
        result[key] = index;
      }
    });
    return result;
  };

  const handleFile = async (picked: File) => {
    setParsing(true);
    setResult(null);
    try {
      const parsed = await readSpreadsheet(picked);
      const firstSheet = parsed.sheetNames[0];
      setFile(picked);
      setWorkbook(parsed);
      setSheetName(firstSheet);
      setMapping(autoMap(parsed, firstSheet));
    } catch (error) {
      notify(describeError(error, 'The file could not be read.'), 'error');
      setFile(null);
      setWorkbook(null);
      setMapping({});
    } finally {
      setParsing(false);
    }
  };

  const resetImport = () => {
    setFile(null);
    setWorkbook(null);
    setSheetName('');
    setMapping({});
    setResult(null);
  };

  const changeSheet = (name: string) => {
    setSheetName(name);
    if (workbook) setMapping(autoMap(workbook, name));
  };

  const runImport = async () => {
    if (!plan) return;
    setImporting(true);
    try {
      const applied = await applyImportPlan(plan);
      setResult(applied);
      setConfirmOpen(false);
      await reload();
      notify(`${applied.inserted} employee record(s) added, ${applied.updated} updated.`, 'success');
    } catch (error) {
      notify(describeError(error, 'The import could not be completed. Nothing was changed.'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const doExport = async (format: 'xlsx' | 'csv') => {
    if (exportRecords.length === 0) {
      notify('There is nothing to export with the current selection.', 'warning');
      return;
    }
    setExporting(true);
    try {
      const options = {
        fileName: `${safeFileName(settings.preferences.appTitle || 'employees')}-${new Date().toISOString().slice(0, 10)}`,
        customFields: settings.customFields,
      };
      if (format === 'xlsx') await exportRecordsToExcel(exportRecords, options);
      else await exportRecordsToCsv(exportRecords, options);
      notify(`${exportRecords.length} employee record(s) exported.`, 'success');
    } catch (error) {
      notify(describeError(error, 'The export failed.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  const doBackup = async () => {
    setBackingUp(true);
    try {
      const backup = await createBackup();
      downloadBackup(backup);
      notify(`Backup created (${backup.records.length} employee record(s), ${backup.images.length} photo(s)).`, 'success');
    } catch (error) {
      notify(describeError(error, 'The backup could not be created.'), 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const confirmRestore = async () => {
    if (!restoreFile) return;
    setRestoreBusy(true);
    try {
      const backup = await parseBackupFile(restoreFile);
      const restored = await restoreBackup(backup);
      await reload();
      await reloadSettings();
      notify(`Backup restored: ${restored.records} employee record(s) and ${restored.images} photo(s).`, 'success');
      setRestoreOpen(false);
      setRestoreFile(null);
      resetImport();
    } catch (error) {
      notify(describeError(error, 'The backup could not be restored.'), 'error');
    } finally {
      setRestoreBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Import / Export</h1>
        <p className="mt-1 text-sm text-ink-500">
          Files are parsed inside your browser. Nothing is uploaded to a server, and importing a spreadsheet updates the
          employee register — it does not create a live link with the file.
        </p>
      </header>

      {/* ------------------------------------------------------------ export */}
      <Card>
        <CardHeader
          title="Export to Excel / CSV"
          description="Photos are not embedded in spreadsheets. Use a full backup below when photo attachments must be preserved."
        />
        <CardBody className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink-800">Which employees?</legend>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name="export-scope"
                className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                checked={exportScope === 'all'}
                onChange={() => setExportScope('all')}
              />
              All records ({records.length})
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="radio"
                name="export-scope"
                className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                checked={exportScope === 'filtered'}
                onChange={() => setExportScope('filtered')}
              />
              Only records matching the filter below ({filteredRecords.length})
            </label>
          </fieldset>

          {exportScope === 'filtered' ? (
            <div className="grid gap-3 rounded-lg border border-ink-200 bg-ink-50 p-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <label htmlFor="export-search" className="block text-xs font-medium text-ink-700">
                  Search
                </label>
                <input
                  id="export-search"
                  type="search"
                  className="field-input"
                  placeholder="Record ID, title…"
                  value={filters.search}
                  onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-category" className="block text-xs font-medium text-ink-700">
                  Category
                </label>
                <select
                  id="export-category"
                  className="field-input"
                  value={filters.category}
                  onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
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
                <label htmlFor="export-from" className="block text-xs font-medium text-ink-700">
                  From
                </label>
                <input
                  id="export-from"
                  type="date"
                  className="field-input"
                  value={filters.dateFrom}
                  onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="export-to" className="block text-xs font-medium text-ink-700">
                  To
                </label>
                <input
                  id="export-to"
                  type="date"
                  className="field-input"
                  value={filters.dateTo}
                  onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              loading={exporting}
              onClick={() => void doExport('xlsx')}
              icon={<FileSpreadsheet className="h-4 w-4" />}
            >
              Export to Excel (.xlsx)
            </Button>
            <Button
              variant="outline"
              loading={exporting}
              onClick={() => void doExport('csv')}
              icon={<Download className="h-4 w-4" />}
            >
              Export to CSV
            </Button>
          </div>

          {exportRecords.length === 0 ? (
            <p className="text-xs text-ink-500">There is nothing to export with the current selection.</p>
          ) : null}
        </CardBody>
      </Card>

      {/* ------------------------------------------------------------ import */}
      <Card>
        <CardHeader
          title="Import Excel / CSV"
          description="Upload a .xlsx, .xls or .csv file, review the mapping and the validation results, and confirm before anything is written."
        />
        <CardBody className="space-y-5">
          {!file ? (
            <div className="rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 px-6 py-10 text-center">
              <FileUp className="mx-auto h-10 w-10 text-ink-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-ink-800">Choose a spreadsheet to import</p>
              <p className="mt-1 text-xs text-ink-500">
                The first row must contain the column headers. Maximum file size 25 MB.
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2">
                {parsing ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                {parsing ? 'Reading file…' : 'Select file'}
                <input
                  type="file"
                  className="sr-only"
                  accept=".xlsx,.xls,.csv,.ods"
                  disabled={parsing}
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    event.target.value = '';
                    if (picked) void handleFile(picked);
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">{file.name}</p>
                  <p className="text-xs text-ink-500">
                    {(file.size / 1024).toFixed(1)} KB · {workbook?.sheetNames.length ?? 0} worksheet(s)
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetImport} icon={<X className="h-4 w-4" />}>
                  Choose another file
                </Button>
              </div>

              {workbook && workbook.sheetNames.length > 1 ? (
                <div className="space-y-1.5">
                  <label htmlFor="import-sheet" className="block text-sm font-medium text-ink-800">
                    Worksheet
                  </label>
                  <select
                    id="import-sheet"
                    className="field-input max-w-sm"
                    value={sheetName}
                    onChange={(event) => changeSheet(event.target.value)}
                  >
                    {workbook.sheetNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* column mapping */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink-900">Column mapping</h3>
                  <p className="mt-0.5 text-xs text-ink-500">
                    Check the automatically detected mapping. Columns that are not needed can be left unmapped.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {importableColumns.map((column) => {
                    const sheet = workbook?.sheets[sheetName];
                    const selected = mapping[column.key];
                    return (
                      <div key={column.key} className="space-y-1.5">
                        <label htmlFor={`map-${column.key}`} className="block text-xs font-medium text-ink-700">
                          {column.label}
                          {column.required ? <span className="ml-0.5 text-red-600">*</span> : null}
                        </label>
                        <select
                          id={`map-${column.key}`}
                          className="field-input"
                          value={selected === undefined ? '' : String(selected)}
                          onChange={(event) => {
                            const value = event.target.value;
                            setMapping((current) => {
                              const next = { ...current };
                              if (value === '') delete next[column.key];
                              else next[column.key] = Number(value);
                              return next;
                            });
                          }}
                        >
                          <option value="">— not mapped —</option>
                          {(sheet?.headers ?? []).map((header, index) => (
                            <option key={`${header}-${index}`} value={index}>
                              {header || `Column ${index + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* preview */}
              {plan ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink-900">Preview</h3>

                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
                    <SummaryTile label="Rows in file" value={plan.total} />
                    <SummaryTile label="Will be created" value={plan.inserts.length} tone="success" />
                    <SummaryTile label="Will be updated" value={plan.updates.length} tone="brand" />
                    <SummaryTile label="Rejected" value={plan.rejected.length} tone={plan.rejected.length ? 'danger' : 'neutral'} />
                    <SummaryTile label="Skipped" value={plan.skipped.length} tone={plan.skipped.length ? 'warning' : 'neutral'} />
                  </div>

                  {plan.duplicates.length > 0 ? (
                    <Alert tone="warning" title="Duplicate Employee IDs inside the file">
                      {plan.duplicates.length} row(s) repeat a Record ID that appears later in the same file. The last
                      occurrence is used, the earlier ones are skipped.
                    </Alert>
                  ) : null}

                  {plan.rejected.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink-800">Rejected rows ({plan.rejected.length})</p>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Download className="h-4 w-4" />}
                          onClick={() =>
                            downloadErrorReport(file.name, plan.rejected, workbook?.sheets[sheetName]?.headers ?? [])
                          }
                        >
                          Download error report
                        </Button>
                      </div>
                      <div className="max-h-64 overflow-auto rounded-lg border border-ink-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-ink-50 text-ink-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">Row</th>
                              <th className="px-3 py-2 font-medium">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {plan.rejected.slice(0, 100).map((row) => (
                              <tr key={row.rowNumber}>
                                <td className="px-3 py-2 align-top text-ink-500">{row.rowNumber}</td>
                                <td className="px-3 py-2 text-red-700">{row.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {plan.skipped.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-ink-800">Skipped rows ({plan.skipped.length})</p>
                      <div className="max-h-48 overflow-auto rounded-lg border border-ink-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-ink-50 text-ink-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">Row</th>
                              <th className="px-3 py-2 font-medium">Reason</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {plan.skipped.slice(0, 50).map((row) => (
                              <tr key={row.rowNumber}>
                                <td className="px-3 py-2 align-top text-ink-500">{row.rowNumber}</td>
                                <td className="px-3 py-2 text-amber-800">{row.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {plan.inserts.length + plan.updates.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-ink-800">Rows to be imported (first 10)</p>
                      <div className="overflow-x-auto rounded-lg border border-ink-200">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-ink-50 text-ink-500">
                            <tr>
                              <th className="px-3 py-2 font-medium">Row</th>
                              <th className="px-3 py-2 font-medium">Employee ID</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                              <th className="px-3 py-2 font-medium">Title</th>
                              <th className="px-3 py-2 font-medium">Category</th>
                              <th className="px-3 py-2 text-right font-medium">Qty</th>
                              <th className="px-3 py-2 text-right font-medium">Total</th>
                              <th className="px-3 py-2 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ink-100">
                            {[...plan.inserts, ...plan.updates].slice(0, 10).map((row) => (
                              <tr key={`${row.rowNumber}-${row.recordId}`}>
                                <td className="px-3 py-2 text-ink-500">{row.rowNumber}</td>
                                <td className="px-3 py-2 font-mono text-ink-700">{row.recordId}</td>
                                <td className="px-3 py-2 text-ink-700">{formatDate(row.input.date)}</td>
                                <td className="px-3 py-2 text-ink-800">{row.input.title}</td>
                                <td className="px-3 py-2 text-ink-700">{row.input.category}</td>
                                <td className="px-3 py-2 text-right text-ink-700">
                                  {row.input.quantity ?? '—'}
                                </td>
                                <td className="px-3 py-2 text-right text-ink-700">
                                  {row.input.quantity === null || row.input.unitPrice === null
                                    ? '—'
                                    : (row.input.quantity * row.input.unitPrice).toFixed(2)}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge tone={plan.updates.includes(row) ? 'brand' : 'success'}>
                                    {plan.updates.includes(row) ? 'Update' : 'Create'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}

                  {/* strategy */}
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium text-ink-800">
              What should happen when an Employee ID already exists?
            </legend>
                    {IMPORT_STRATEGIES.map((option) => (
                      <label key={option.value} className="flex cursor-pointer gap-3 rounded-lg border border-ink-200 p-3 hover:bg-ink-50">
                        <input
                          type="radio"
                          name="import-strategy"
                          className="mt-0.5 h-4 w-4 text-brand-600 focus:ring-brand-500"
                          checked={strategy === option.value}
                          onChange={() => setStrategy(option.value)}
                        />
                        <span>
                          <span className="block text-sm font-medium text-ink-800">{option.label}</span>
                          <span className="mt-0.5 block text-xs text-ink-500">{option.description}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>

            <Alert tone="info" title="Photos are preserved">
              Importing never deletes or replaces a photo that is already attached to an employee.
            </Alert>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={resetImport}>
                      Cancel
                    </Button>
                    <Button
                      disabled={plan.inserts.length + plan.updates.length === 0}
                      onClick={() => setConfirmOpen(true)}
                      icon={<Upload className="h-4 w-4" />}
                    >
                      Import {plan.inserts.length + plan.updates.length} record(s)
                    </Button>
                  </div>
                </div>
              ) : (
                <Spinner label="Reading rows…" />
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ----------------------------------------------------------- backup */}
      <Card>
        <CardHeader
          title="Backup and restore"
          description="A full backup contains every employee record, the settings and all photo attachments in a single JSON file."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button loading={backingUp} onClick={() => void doBackup()} icon={<FileJson className="h-4 w-4" />}>
              Download full backup (.json)
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setRestoreFile(null);
                setRestoreOpen(true);
              }}
              icon={<RefreshCw className="h-4 w-4" />}
            >
              Restore from backup
            </Button>
          </div>

          <Alert tone="info" title="Where is my data?">
            Employee data lives in this browser&apos;s IndexedDB. It is tied to this browser profile and device, is not
            synchronised anywhere, and disappears when site data is cleared. Browser storage is not encrypted — do not use
            it for highly sensitive information. Download a backup regularly and keep it somewhere safe.
          </Alert>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Apply the import"
        busy={importing}
        confirmLabel={`Import ${plan ? plan.inserts.length + plan.updates.length : 0} record(s)`}
        message={
          <>
            <p>
              {plan ? plan.inserts.length : 0} record(s) will be created and {plan ? plan.updates.length : 0} record(s)
              will be updated in the local database.
            </p>
            <p>
              The import runs inside a single database transaction: if it fails, nothing is changed. Existing photos are
              never replaced or removed by an import.
            </p>
          </>
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void runImport()}
      />

      <ConfirmDialog
        open={restoreOpen}
        title="Restore a backup"
        destructive
        busy={restoreBusy}
        confirmLabel="Choose backup file"
        message={
          <>
            <p>Restoring replaces every employee record, photo and setting currently stored in this browser.</p>
            <p>Export a backup of the current data first if you still need it.</p>
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm font-medium text-ink-800 transition hover:bg-ink-50">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {restoreFile ? restoreFile.name : 'Select backup file…'}
              <input
                type="file"
                className="sr-only"
                accept=".json,application/json"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  event.target.value = '';
                  setRestoreFile(picked ?? null);
                }}
              />
            </label>
          </>
        }
        onCancel={() => setRestoreOpen(false)}
        onConfirm={() => {
          if (!restoreFile) {
            notify('Please select a backup file first.', 'warning');
            return;
          }
          void confirmRestore();
        }}
      />

      {result ? (
        <Alert tone="success" title="Import finished">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {result.inserted} record(s) created and {result.updated} record(s) updated.
          </p>
        </Alert>
      ) : null}

      {plan && plan.rejected.length > 0 ? (
        <p className="flex items-center gap-2 text-xs text-ink-500">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          {plan.rejected.length} row(s) could not be imported. Download the error report for the details.
        </p>
      ) : null}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'success' | 'brand' | 'danger' | 'warning';
}) {
  const toneClass = {
    neutral: 'border-ink-200 bg-white text-ink-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    brand: 'border-brand-200 bg-brand-50 text-brand-900',
    danger: 'border-red-200 bg-red-50 text-red-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];

  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
