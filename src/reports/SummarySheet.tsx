import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import type { ReportLayoutProps } from './types';

/** Compact table of the selected records — suitable for quick review. */
export function SummarySheet({ records, currency, customFields, showQuantities = true }: ReportLayoutProps) {
  const totalQuantity = records.reduce((sum, record) => sum + (record.quantity ?? 0), 0);
  const totalAmount = records.reduce((sum, record) => sum + (record.totalAmount ?? 0), 0);

  return (
    <div className="space-y-3">
      <table className="w-full border-collapse text-[10px] leading-tight">
        <thead>
          <tr className="bg-ink-100 print:bg-ink-100">
            <th className="border border-ink-400 px-1.5 py-1 text-left font-semibold text-ink-900">Employee ID</th>
            <th className="border border-ink-400 px-1.5 py-1 text-left font-semibold text-ink-900">Date</th>
            <th className="border border-ink-400 px-1.5 py-1 text-left font-semibold text-ink-900">Title</th>
            <th className="border border-ink-400 px-1.5 py-1 text-left font-semibold text-ink-900">Category</th>
            {showQuantities ? (
              <>
                <th className="border border-ink-400 px-1.5 py-1 text-right font-semibold text-ink-900">Qty</th>
                <th className="border border-ink-400 px-1.5 py-1 text-right font-semibold text-ink-900">Total</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id} className="report-block align-top">
              <td className="border border-ink-400 px-1.5 py-1 font-mono text-[9px] text-ink-800">{record.recordId}</td>
              <td className="border border-ink-400 px-1.5 py-1 whitespace-nowrap text-ink-800">{formatDate(record.date)}</td>
              <td className="border border-ink-400 px-1.5 py-1 text-ink-900">
                {record.title}
                {record.description ? (
                  <span className="block text-[9px] font-normal text-ink-600">
                    {record.description.length > 120 ? `${record.description.slice(0, 120)}…` : record.description}
                  </span>
                ) : null}
              </td>
              <td className="border border-ink-400 px-1.5 py-1 text-ink-800">{record.category}</td>
              {showQuantities ? (
                <>
                  <td className="border border-ink-400 px-1.5 py-1 text-right text-ink-800">
                    {record.quantity === null ? '—' : formatNumber(record.quantity, 2)}
                  </td>
                  <td className="border border-ink-400 px-1.5 py-1 text-right text-ink-800">
                    {record.totalAmount === null ? '—' : formatCurrency(record.totalAmount, currency)}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="border border-ink-400 px-1.5 py-1" colSpan={showQuantities ? 4 : 4}>
              {records.length} record(s)
            </td>
            {showQuantities ? (
              <>
                <td className="border border-ink-400 px-1.5 py-1 text-right">{formatNumber(totalQuantity, 2)}</td>
                <td className="border border-ink-400 px-1.5 py-1 text-right">{formatCurrency(totalAmount, currency)}</td>
              </>
            ) : null}
          </tr>
        </tfoot>
      </table>

      {customFields.length > 0 ? (
        <p className="text-[9px] text-ink-600">
          Additional fields available for this report: {customFields.map((field) => field.label).join(', ')}.
        </p>
      ) : null}
    </div>
  );
}
