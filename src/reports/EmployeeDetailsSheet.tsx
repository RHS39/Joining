/**
 * Print ready sheet with the details of one or more employees.
 *
 * The sheet follows the paper form of the plant: the "New Joining Form" is
 * printed with the values of the employee, one employee per page. The sheet is
 * rendered inside the `.print-area` element so the print stylesheet turns the
 * preview into the page. Nothing but the form itself is printed.
 */
import { cx } from '@/lib/cx';
import { pageSizeInMm } from '@/lib/format';
import { EmployeeJoiningForm } from './EmployeeJoiningForm';
import type { DataRecord, ImageAttachment, Orientation, PageSize } from '@/types';

/**
 * The margin of the printed page — it is narrow, so the form fills the paper
 * the way the paper form of the plant does.
 */
export const FORM_MARGIN_MM = 8;

export interface EmployeeDetailsSheetProps {
  records: DataRecord[];
  images: Map<string, ImageAttachment>;
  pageSize: PageSize;
  orientation: Orientation;
  organisation: string;
}

export function EmployeeDetailsSheet({
  records,
  images,
  pageSize,
  orientation,
  organisation,
}: EmployeeDetailsSheetProps) {
  const millimetres = pageSizeInMm(pageSize);
  const isLandscape = orientation === 'landscape';
  const width = isLandscape ? millimetres.height : millimetres.width;
  const height = isLandscape ? millimetres.width : millimetres.height;

  return (
    <div
      className="print-area mx-auto bg-white text-ink-900 shadow-pop"
      style={{ width: `${width}mm`, minHeight: `${height}mm`, padding: `${FORM_MARGIN_MM}mm` }}
    >
      {records.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-ink-500">No employee selected for printing.</p>
      ) : null}

      {records.map((record, index) => (
        <section
          key={record.id}
          className={cx('report-block', index < records.length - 1 && 'report-break-after')}
        >
          <EmployeeJoiningForm
            record={record}
            image={images.get(record.id)}
            organisation={organisation}
          />
        </section>
      ))}
    </div>
  );
}
