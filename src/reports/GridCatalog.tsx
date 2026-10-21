import { useObjectUrl } from '@/hooks/useImages';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import type { ReportLayoutProps } from './types';

function Thumb({ recordKey, images, alt }: { recordKey: string; images: ReportLayoutProps['images']; alt: string }) {
  const attachment = images.get(recordKey);
  const url = useObjectUrl(attachment?.blob);
  if (!url) {
    return <div className="flex h-24 w-full items-center justify-center bg-ink-50 text-[9px] text-ink-400">No photo</div>;
  }
  return <img src={url} alt={alt} className="h-24 w-full bg-ink-50 object-contain" />;
}

/** Compact visual catalogue — thumbnails, titles, ids, categories and numbers. */
export function GridCatalog({ records, images, currency, columns, showQuantities = true }: ReportLayoutProps) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {records.map((record) => (
        <article key={record.id} className="report-block flex flex-col border border-ink-400">
          <Thumb recordKey={record.id} images={images} alt={`Photo of ${record.title}`} />
          <div className="flex flex-1 flex-col p-2">
            <p className="font-mono text-[8px] text-ink-600">{record.recordId}</p>
            <h3 className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-ink-900">{record.title}</h3>
            <p className="mt-0.5 text-[9px] text-ink-600">{record.category}</p>
            <dl className="mt-1.5 space-y-0.5 text-[9px]">
              <div className="flex justify-between">
                <dt className="text-ink-500">Joined</dt>
                <dd className="text-ink-800">{formatDate(record.date)}</dd>
              </div>
              {showQuantities ? (
                <>
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Qty</dt>
                    <dd className="text-ink-800">{record.quantity === null ? '—' : formatNumber(record.quantity, 2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-500">Total</dt>
                    <dd className="text-ink-800">
                      {record.totalAmount === null ? '—' : formatCurrency(record.totalAmount, currency)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          </div>
        </article>
      ))}
    </div>
  );
}
