import { AssetCard } from './AssetCard';
import { GridCatalog } from './GridCatalog';
import { SummarySheet } from './SummarySheet';
import { formatDateTime } from '@/lib/format';
import { pageSizeInMm } from '@/lib/format';
import type { DataRecord, FieldDefinition, ImageAttachment, Orientation, PageSize, ReportLayout } from '@/types';

export interface ReportDocumentProps {
  layout: ReportLayout;
  records: DataRecord[];
  images: Map<string, ImageAttachment>;
  pageSize: PageSize;
  orientation: Orientation;
  title: string;
  organisation: string;
  footerNote: string;
  currency: string;
  customFields: FieldDefinition[];
  showHeader: boolean;
  showFooter: boolean;
  showImages: boolean;
  showQuantities: boolean;
  oneCardPerPage: boolean;
  generatedAt: string;
}

export function ReportDocument({
  layout,
  records,
  images,
  pageSize,
  orientation,
  title,
  organisation,
  footerNote,
  currency,
  customFields,
  showHeader,
  showFooter,
  showImages,
  showQuantities,
  oneCardPerPage,
  generatedAt,
}: ReportDocumentProps) {
  const millimetres = pageSizeInMm(pageSize);
  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? millimetres.height : millimetres.width;
  const height = isLandscape ? millimetres.width : millimetres.height;
  const gridColumns = isLandscape ? 4 : 3;

  const effectiveImages = showImages ? images : new Map<string, ImageAttachment>();

  const layoutProps = {
    records,
    images: effectiveImages,
    currency,
    customFields,
    columns: gridColumns,
    oneCardPerPage,
    showQuantities,
  };

  return (
    <div
      className="print-area mx-auto bg-white text-ink-900 shadow-pop"
      style={{ width: `${width}mm`, minHeight: `${height}mm`, padding: '12mm' }}
    >
      {showHeader ? (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink-800 pb-2">
          <div>
            <h1 className="text-[16px] font-bold tracking-tight text-ink-900">{title}</h1>
            {organisation ? <p className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-600">{organisation}</p> : null}
          </div>
          <div className="text-right text-[9px] leading-tight text-ink-600">
            <p>{records.length} employee(s)</p>
            <p>Generated {formatDateTime(generatedAt)}</p>
            <p>
              {pageSize} · {orientation}
            </p>
          </div>
        </header>
      ) : null}

      {records.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-ink-500">
          No records selected for this report.
        </p>
      ) : layout === 'summary' ? (
        <SummarySheet {...layoutProps} />
      ) : layout === 'card' ? (
        <AssetCard {...layoutProps} />
      ) : (
        <GridCatalog {...layoutProps} />
      )}

      {showFooter ? (
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-ink-400 pt-1.5 text-[9px] text-ink-600">
          <span>{footerNote || 'Generated with the employee register — data stored locally in the browser.'}</span>
          <span>{title}</span>
        </footer>
      ) : null}
    </div>
  );
}
