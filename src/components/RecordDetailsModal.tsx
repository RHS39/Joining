import { Printer, Trash2 } from 'lucide-react';
import { useObjectUrl } from '@/hooks/useImages';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import { groupFieldsBySection } from '@/lib/fields';
import type { DataRecord, FieldDefinition, ImageAttachment } from '@/types';

interface RecordDetailsModalProps {
  record: DataRecord | null;
  image?: ImageAttachment;
  customFields: FieldDefinition[];
  currency: string;
  /** Hide the quantity, unit price and total amount rows. */
  showQuantities?: boolean;
  onClose: () => void;
  onEdit: (record: DataRecord) => void;
  onDelete: (record: DataRecord) => void;
  /** Print the details of the employee. */
  onPrint: (record: DataRecord) => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-100 py-2 last:border-b-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

export function RecordDetailsModal({
  record,
  image,
  customFields,
  currency,
  showQuantities = true,
  onClose,
  onEdit,
  onDelete,
  onPrint,
}: RecordDetailsModalProps) {
  const url = useObjectUrl(image?.blob);
  const customSections = groupFieldsBySection(customFields);

  return (
    <Modal
      open={Boolean(record)}
      title={record ? record.title : ''}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button
            variant="outline"
            className="text-red-600"
            onClick={() => record && onDelete(record)}
            icon={<Trash2 className="h-4 w-4" />}
          >
            Delete
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => record && onPrint(record)}
            icon={<Printer className="h-4 w-4" />}
          >
            Print details
          </Button>
          <Button onClick={() => record && onEdit(record)}>Edit employee</Button>
        </>
      }
    >
      {record ? (
        <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
          <div>
            <div className="flex h-48 w-full items-center justify-center overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
              {url ? (
                <img src={url} alt={`Photo of ${record.title}`} className="h-full w-full object-contain" />
              ) : (
                <span className="px-3 text-center text-xs text-ink-400">No photo attached</span>
              )}
            </div>
            {image ? (
              <p className="mt-2 text-center text-xs text-ink-500">
                {image.width} x {image.height} px
              </p>
            ) : null}
          </div>

          <div>
            <dl>
              <DetailRow label="Employee ID" value={<span className="font-mono">{record.recordId}</span>} />
              <DetailRow label="Date of Joining" value={formatDate(record.date)} />
              <DetailRow label="Category" value={<Badge tone="brand">{record.category}</Badge>} />
              {showQuantities ? (
                <>
                  <DetailRow label="Quantity" value={record.quantity === null ? '—' : formatNumber(record.quantity, 2)} />
                  <DetailRow
                    label="Unit price"
                    value={record.unitPrice === null ? '—' : formatCurrency(record.unitPrice, currency)}
                  />
                  <DetailRow
                    label="Total amount"
                    value={record.totalAmount === null ? '—' : formatCurrency(record.totalAmount, currency)}
                  />
                </>
              ) : null}
              {customSections.map((group) => (
                <div key={group.section || 'details'} className="mt-4 first:mt-0">
                  {group.section ? (
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{group.section}</p>
                  ) : null}
                  <dl>
                    {group.fields.map((field) => {
                      const value = record.custom?.[field.key];
                      return (
                        <DetailRow
                          key={field.key}
                          label={field.label}
                          value={value === null || value === undefined || value === '' ? '—' : String(value)}
                        />
                      );
                    })}
                  </dl>
                </div>
              ))}
              <DetailRow label="Created" value={formatDateTime(record.createdAt)} />
              <DetailRow label="Updated" value={formatDateTime(record.updatedAt)} />
            </dl>

            <div className="mt-4">
              <p className="text-sm text-ink-500">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-800">
                {record.description ? record.description : <span className="text-ink-400">No remarks provided.</span>}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
