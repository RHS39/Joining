import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { useImagesMap } from '@/hooks/useImages';
import { usePageSizeStyle } from '@/hooks/usePageSizeStyle';
import { EmployeeDetailsSheet, FORM_MARGIN_MM } from '@/reports/EmployeeDetailsSheet';
import { Button } from './ui/Button';
import type { DataRecord, Orientation, PageSize } from '@/types';

export interface PrintEmployeeDialogProps {
  records: DataRecord[];
  pageSize: PageSize;
  orientation: Orientation;
  organisation: string;
  onClose: () => void;
}

/** Wait for the photos of the sheet to be decoded, but never longer than this. */
const IMAGE_TIMEOUT_MS = 3000;

/**
 * Preview of the employee details sheet with the print button.
 *
 * The sheet is rendered into a portal at the end of the document so the print
 * stylesheet can turn it into the printed page — the application itself is
 * hidden while printing.
 */
export function PrintEmployeeDialog({
  records,
  pageSize,
  orientation,
  organisation,
  onClose,
}: PrintEmployeeDialogProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [preparing, setPreparing] = useState(false);

  const images = useImagesMap(records.map((record) => record.id));

  usePageSizeStyle(pageSize, orientation, FORM_MARGIN_MM);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  /**
   * Wait until every photo of the sheet is on the page — the blobs are read
   * from the database and the object URL is created a tick later.
   */
  const waitForPhotos = async () => {
    const expected = records.filter((record) => record.hasImage).length;
    const deadline = Date.now() + IMAGE_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const elements = Array.from(rootRef.current?.querySelectorAll('img') ?? []) as HTMLImageElement[];
      if (elements.length >= expected && elements.every((image) => image.complete)) return;
      await new Promise((resolve) => {
        window.setTimeout(resolve, 100);
      });
    }
  };

  const handlePrint = async () => {
    setPreparing(true);
    try {
      await waitForPhotos();
      window.print();
    } finally {
      setPreparing(false);
    }
  };

  return createPortal(
    <div
      ref={rootRef}
      className="print-overlay fixed inset-0 z-50 overflow-auto bg-ink-950/60"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="no-print sticky top-0 z-10 border-b border-ink-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink-900">Print employee details</h2>
            <p className="text-xs text-ink-500">
              {records.length} employee{records.length === 1 ? '' : 's'} · {pageSize} · {orientation}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => void handlePrint()} loading={preparing} icon={<Printer className="h-4 w-4" />}>
              Print / Save as PDF
            </Button>
            <Button variant="outline" onClick={onClose} icon={<X className="h-4 w-4" />}>
              Close
            </Button>
          </div>
        </div>
      </div>

      <div className="print-sheet p-4">
        <EmployeeDetailsSheet
          records={records}
          images={images}
          pageSize={pageSize}
          orientation={orientation}
          organisation={organisation}
        />
      </div>
    </div>,
    document.body,
  );
}
