import { useObjectUrl } from '@/hooks/useImages';
import { groupFieldsBySection } from '@/lib/fields';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { ReportLayoutProps } from './types';

function CardImage({ recordKey, images, alt }: { recordKey: string; images: ReportLayoutProps['images']; alt: string }) {
  const attachment = images.get(recordKey);
  const url = useObjectUrl(attachment?.blob);
  if (!url) {
    return (
      <div className="flex h-36 w-28 shrink-0 items-center justify-center border border-ink-300 bg-ink-50 text-[9px] text-ink-400">
        No photo
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-36 w-28 shrink-0 border border-ink-300 object-cover"
    />
  );
}

/** One detailed card per record — documentation / asset card style. */
export function AssetCard({
  records,
  images,
  currency,
  customFields,
  oneCardPerPage,
  showQuantities = true,
}: ReportLayoutProps) {
  const customSections = groupFieldsBySection(customFields);
  return (
    <div className="space-y-4">
      {records.map((record, index) => (
        <article
          key={record.id}
          className={`report-block border border-ink-400 p-3 ${
            oneCardPerPage && index < records.length - 1 ? 'report-break-after' : ''
          }`}
        >
          <div className="flex gap-4">
            <CardImage recordKey={record.id} images={images} alt={`Photo of ${record.title}`} />

            <div className="min-w-0 flex-1">
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-300 pb-1.5">
                <h3 className="text-[13px] font-semibold text-ink-900">{record.title}</h3>
                <span className="font-mono text-[9px] text-ink-600">{record.recordId}</span>
              </header>

              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <Field label="Date of Joining" value={formatDate(record.date)} />
                <Field label="Category" value={record.category} />
                {showQuantities ? (
                  <>
                    <Field label="Quantity" value={record.quantity === null ? '—' : formatNumber(record.quantity, 2)} />
                    <Field
                      label="Unit price"
                      value={record.unitPrice === null ? '—' : formatCurrency(record.unitPrice, currency)}
                    />
                    <Field
                      label="Total amount"
                      value={record.totalAmount === null ? '—' : formatCurrency(record.totalAmount, currency)}
                    />
                  </>
                ) : null}
                <Field label="Created" value={formatDateTime(record.createdAt)} />
              </dl>

              {customSections.map((group) => (
                <div key={group.section || 'details'} className="mt-2">
                  {group.section ? (
                    <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-500">{group.section}</p>
                  ) : null}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                    {group.fields.map((field) => {
                      const value = record.custom?.[field.key];
                      return (
                        <Field
                          key={field.key}
                          label={field.label}
                          value={value === null || value === undefined || value === '' ? '—' : String(value)}
                        />
                      );
                    })}
                  </dl>
                </div>
              ))}

              {record.description ? (
                <div className="mt-2">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-500">Description</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[10px] leading-relaxed text-ink-800">{record.description}</p>
                </div>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-1">
      <dt className="w-24 shrink-0 text-ink-500">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap break-words font-medium text-ink-900">{value}</dd>
    </div>
  );
}
