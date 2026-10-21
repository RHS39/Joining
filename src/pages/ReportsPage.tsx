import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Grid3x3, LayoutList, Printer, Rows3 } from 'lucide-react';
import { useRecords } from '@/components/RecordsContext';
import { useSettings } from '@/components/SettingsContext';
import { useToast } from '@/components/ui/Toast';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useImagesMap } from '@/hooks/useImages';
import { usePageSizeStyle } from '@/hooks/usePageSizeStyle';
import { ReportDocument } from '@/reports/ReportDocument';
import { sortAndFilter } from '@/db/repository';
import { EMPTY_FILTERS, type Orientation, type PageSize, type RecordFilters, type ReportLayout } from '@/types';

const LAYOUTS: { value: ReportLayout; label: string; description: string; icon: typeof LayoutList }[] = [
  {
    value: 'summary',
    label: 'Employee list',
    description: 'Compact table with the key fields of every selected employee.',
    icon: LayoutList,
  },
  {
    value: 'card',
    label: 'Employee card',
    description: 'One card per employee including the remarks and the photo.',
    icon: Rows3,
  },
  {
    value: 'grid',
    label: 'Employee directory',
    description: 'Compact visual grid with photo thumbnails for the employee directory.',
    icon: Grid3x3,
  },
];

export default function ReportsPage() {
  const { records } = useRecords();
  const { settings } = useSettings();
  const { notify } = useToast();

  const [layout, setLayout] = useState<ReportLayout>('summary');
  const [pageSize, setPageSize] = useState<PageSize>(settings.preferences.defaultPageSize);
  const [orientation, setOrientation] = useState<Orientation>(settings.preferences.defaultOrientation);
  const [filters, setFilters] = useState<RecordFilters>(EMPTY_FILTERS);
  const [selectionMode, setSelectionMode] = useState<'all' | 'manual'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  const [showImages, setShowImages] = useState(settings.preferences.showImagesInReports);
  const [oneCardPerPage, setOneCardPerPage] = useState(false);
  const [reportTitle, setReportTitle] = useState(
    settings.preferences.appTitle ? `${settings.preferences.appTitle} — Report` : 'Report',
  );
  const [organisation, setOrganisation] = useState(settings.preferences.organisation);
  const [footerNote, setFooterNote] = useState(settings.preferences.footerNote);
  const [generatedAt] = useState(() => new Date().toISOString());

  usePageSizeStyle(pageSize, orientation);

  const filtered = useMemo(() => sortAndFilter(records, filters, 'date', 'asc'), [records, filters]);

  const reportRecords = useMemo(() => {
    if (selectionMode === 'all') return filtered;
    const selection = new Set(selectedIds);
    return filtered.filter((record) => selection.has(record.id));
  }, [filtered, selectionMode, selectedIds]);

  const images = useImagesMap(reportRecords.map((record) => record.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePrint = () => {
    if (reportRecords.length === 0) {
      notify('Select at least one employee before printing.', 'warning');
      return;
    }
    window.print();
  };

  return (
    <div className="print-page min-h-screen bg-ink-100">
      <header className="no-print sticky top-0 z-30 border-b border-ink-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-ink-700 hover:text-ink-900">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to the app
          </Link>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-ink-500 sm:inline">
              {reportRecords.length} record(s) · {pageSize} · {orientation}
            </span>
            <Button onClick={handlePrint} icon={<Printer className="h-4 w-4" />}>
              Print report / Save as PDF
            </Button>
          </div>
        </div>
      </header>

      <div className="no-print mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <Card>
          <CardHeader
            title="Report configuration"
            description="The preview below is exactly what will be printed. Choose the records, the layout and the paper format."
          />
          <CardBody className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink-800">Layout</legend>
              <div className="grid gap-3 md:grid-cols-3">
                {LAYOUTS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                      layout === option.value ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-layout"
                      className="mt-0.5 h-4 w-4 text-brand-600 focus:ring-brand-500"
                      checked={layout === option.value}
                      onChange={() => setLayout(option.value)}
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
                        <option.icon className="h-4 w-4" aria-hidden="true" />
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-500">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor="report-page-size" className="block text-sm font-medium text-ink-800">
                  Paper size
                </label>
                <select
                  id="report-page-size"
                  className="field-input"
                  value={pageSize}
                  onChange={(event) => setPageSize(event.target.value as PageSize)}
                >
                  <option value="A4">A4 (210 × 297 mm)</option>
                  <option value="Letter">US Letter (8.5 × 11 in)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="report-orientation" className="block text-sm font-medium text-ink-800">
                  Orientation
                </label>
                <select
                  id="report-orientation"
                  className="field-input"
                  value={orientation}
                  onChange={(event) => setOrientation(event.target.value as Orientation)}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="report-category" className="block text-sm font-medium text-ink-800">
                  Category
                </label>
                <select
                  id="report-category"
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
                <label htmlFor="report-from" className="block text-sm font-medium text-ink-800">
                  Date from
                </label>
                <input
                  id="report-from"
                  type="date"
                  className="field-input"
                  value={filters.dateFrom}
                  onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="report-to" className="block text-sm font-medium text-ink-800">
                  Date to
                </label>
                <input
                  id="report-to"
                  type="date"
                  className="field-input"
                  value={filters.dateTo}
                  onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="report-title" className="block text-sm font-medium text-ink-800">
                  Report title
                </label>
                <input
                  id="report-title"
                  type="text"
                  className="field-input"
                  value={reportTitle}
                  onChange={(event) => setReportTitle(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="report-organisation" className="block text-sm font-medium text-ink-800">
                  Header sub-title
                </label>
                <input
                  id="report-organisation"
                  type="text"
                  className="field-input"
                  value={organisation}
                  placeholder="e.g. Central store"
                  onChange={(event) => setOrganisation(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="report-footer" className="block text-sm font-medium text-ink-800">
                  Footer note
                </label>
                <input
                  id="report-footer"
                  type="text"
                  className="field-input"
                  value={footerNote}
                  placeholder="e.g. Confidential — internal use only"
                  onChange={(event) => setFooterNote(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Toggle
                label="Show header"
                checked={showHeader}
                onChange={setShowHeader}
                hint="Title, employee count and generation date"
              />
              <Toggle label="Show footer" checked={showFooter} onChange={setShowFooter} hint="Note printed on every page" />
              <Toggle
                label="Include photos"
                checked={showImages}
                onChange={setShowImages}
                hint="Requires the employee to have a photo attached"
              />
              <Toggle
                label="One card per page"
                checked={oneCardPerPage}
                onChange={setOneCardPerPage}
                hint="Detailed card layout only"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-ink-800">Which employees?</legend>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="radio"
                    name="report-selection"
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                    checked={selectionMode === 'all'}
                    onChange={() => setSelectionMode('all')}
                  />
                  All employees matching the filters ({filtered.length})
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-700">
                  <input
                    type="radio"
                    name="report-selection"
                    className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                    checked={selectionMode === 'manual'}
                    onChange={() => setSelectionMode('manual')}
                  />
                  Manually selected ({selectedIds.size})
                </label>
              </div>

              {selectionMode === 'manual' ? (
                <div className="max-h-56 overflow-auto rounded-lg border border-ink-200">
                  {filtered.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-ink-500">No employees match the current filters.</p>
                  ) : (
                    <ul className="divide-y divide-ink-100">
                      {filtered.map((record) => (
                        <li key={record.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-ink-50">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                              checked={selectedIds.has(record.id)}
                              onChange={() => toggleSelected(record.id)}
                            />
                            <span className="min-w-0 flex-1 truncate text-ink-800">{record.title}</span>
                            <span className="font-mono text-xs text-ink-500">{record.recordId}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </fieldset>

            <Alert tone="info" title="How printing works">
              The button opens your browser&apos;s print dialog. Choose a printer, or pick{' '}
              <strong>Save as PDF</strong> as the destination to create a PDF file. The browser generates the PDF — the
              application does not create or download a PDF itself. Make sure the paper size in the print dialog matches
              the selection above ({pageSize}, {orientation}).
            </Alert>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{LAYOUTS.find((item) => item.value === layout)?.label}</Badge>
          <Badge>{pageSize}</Badge>
          <Badge>{orientation}</Badge>
          <Badge>{reportRecords.length} employees</Badge>
        </div>
      </div>

      <div className="print-preview-container overflow-x-auto px-4 py-6 sm:px-6 lg:px-8">
        <ReportDocument
          layout={layout}
          records={reportRecords}
          images={images}
          pageSize={pageSize}
          orientation={orientation}
          title={reportTitle}
          organisation={organisation}
          footerNote={footerNote}
          currency={settings.preferences.currency}
          customFields={settings.customFields}
          showHeader={showHeader}
          showFooter={showFooter}
          showImages={showImages}
          showQuantities={settings.preferences.showQuantities !== false}
          oneCardPerPage={oneCardPerPage}
          generatedAt={generatedAt}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-ink-200 p-3 hover:bg-ink-50">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-ink-500">{hint}</span> : null}
      </span>
    </label>
  );
}
