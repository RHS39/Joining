import { useEffect, useRef, useState } from 'react';
import { FileText, RefreshCw, Sparkles, Upload, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Alert } from './ui/Alert';
import { Badge } from './ui/Badge';
import { Spinner } from './ui/Spinner';
import { describeError } from '@/lib/errors';
import { openPdf, ocrPdfPage, type PdfSession } from '@/lib/pdf';
import { buildMatch, detectStandardFormat, mapPdfToFields, type PdfMatch, type PdfTarget } from '@/lib/pdfMapping';

export interface PdfAutoFillProps {
  /** Fields that can be filled from the PDF. */
  targets: PdfTarget[];
  /** Called with the values the user confirmed. */
  onApply: (values: Record<string, string>) => void;
}

type Status = 'idle' | 'busy' | 'done' | 'error';

/**
 * "Auto-fill from PDF": upload a filled joining form and read the values out
 * of it. Everything is read in the browser, nothing is uploaded anywhere.
 */
export function PdfAutoFill({ targets, onApply }: PdfAutoFillProps) {
  const sessionRef = useRef<PdfSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [formatName, setFormatName] = useState<string | null>(null);
  const [rows, setRows] = useState<PdfMatch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [needsOcr, setNeedsOcr] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      void sessionRef.current?.close();
      sessionRef.current = null;
    };
  }, []);

  const closeSession = async () => {
    await sessionRef.current?.close();
    sessionRef.current = null;
  };

  const storeRows = (found: PdfMatch[]) => {
    setRows(found);
    setSelected(new Set(found.map((row) => row.key)));
    setNeedsOcr(false);
    setStatus('done');
  };

  const handleFile = async (file: File) => {
    setStatus('busy');
    setError(null);
    setRows([]);
    setSelected(new Set());
    setNeedsOcr(false);
    setOcrStatus(null);

    try {
      await closeSession();
      const session = await openPdf(file);
      sessionRef.current = session;
      setFileName(session.fileName);

      const pages = await session.read();
      const words = pages.reduce((sum, page) => sum + page.words.length, 0);
      if (words === 0) {
        setNeedsOcr(true);
        setStatus('idle');
        return;
      }
      setFormatName(detectStandardFormat(pages)?.name ?? null);
      storeRows(mapPdfToFields(pages, targets));
    } catch (cause) {
      setError(describeError(cause, 'The PDF could not be read.'));
      setStatus('error');
    }
  };

  const runOcr = async () => {
    const session = sessionRef.current;
    if (!session) return;

    setOcrStatus('Preparing the OCR engine…');
    setStatus('busy');
    setError(null);

    try {
      const pages = [];
      for (let pageNumber = 1; pageNumber <= session.pageCount; pageNumber += 1) {
        setOcrStatus(`Reading page ${pageNumber} of ${session.pageCount} with OCR…`);
        // The OCR engine is loaded on demand and needs an internet connection.
        const page = await ocrPdfPage(session, pageNumber, (progress) => {
          setOcrStatus(`${progress.status} (${Math.round(progress.progress * 100)} %)`);
        });
        pages.push(page);
      }
      setOcrStatus(null);
      setFormatName(detectStandardFormat(pages)?.name ?? null);
      storeRows(mapPdfToFields(pages, targets));
    } catch (cause) {
      setOcrStatus(null);
      setError(
        describeError(
          cause,
          'The page could not be read with OCR. Try a sharper scan of the page.',
        ),
      );
      setStatus('error');
    }
  };

  const updateRow = (key: string, patch: Partial<PdfMatch>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const changeTarget = (row: PdfMatch, targetKey: string) => {
    const target = targets.find((item) => item.key === targetKey);
    if (!target) return;
    // The value is read again for the new field — a date stays a date.
    const checked = buildMatch(target, row.rawValue || row.value, row.pageNumber, row.confidence, row.matchedText);
    // Two rows must not fill the same field — the last one wins.
    setRows((current) => [
      ...current.filter((item) => item.key !== row.key && item.key !== target.key),
      {
        ...row,
        key: target.key,
        label: target.label,
        value: checked.value,
        warning: checked.warning,
        hint: checked.hint,
      },
    ]);
    setSelected((current) => {
      const next = new Set(current);
      next.delete(row.key);
      next.add(target.key);
      return next;
    });
  };

  const editValue = (row: PdfMatch, value: string) => {
    const target = targets.find((item) => item.key === row.key);
    if (!target) {
      updateRow(row.key, { value });
      return;
    }
    const checked = buildMatch(target, value, row.pageNumber, row.confidence, row.matchedText);
    updateRow(row.key, {
      value: checked.value,
      rawValue: value,
      warning: checked.warning,
      hint: checked.hint,
    });
  };

  const apply = () => {
    const values: Record<string, string> = {};
    rows.forEach((row) => {
      if (!selected.has(row.key)) return;
      if (row.warning) return;
      const value = row.value.trim();
      if (!value) return;
      values[row.key] = value;
    });
    onApply(values);
  };

  const reset = async () => {
    await closeSession();
    setStatus('idle');
    setError(null);
    setRows([]);
    setSelected(new Set());
    setNeedsOcr(false);
    setOcrStatus(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader
        title="Auto-fill from a PDF"
        description="Upload a filled joining form: the values are read in this browser and written into the form below. Nothing is uploaded anywhere."
      />
      <CardBody className="space-y-4">
        {status === 'idle' || status === 'error' ? (
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <FileText className="h-9 w-9 text-ink-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-ink-800">
              {fileName || 'Choose the PDF of a filled joining form'}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              The photo of the form is not imported — attach it separately below.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Select PDF
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  const picked = event.target.files?.[0];
                  event.target.value = '';
                  if (picked) void handleFile(picked);
                }}
              />
            </span>
          </label>
        ) : null}

        {status === 'busy' ? (
          <div className="space-y-3">
            <Spinner label={ocrStatus ?? 'Reading the PDF…'} />
          </div>
        ) : null}

        {status === 'error' && error ? (
          <Alert tone="error" title="The PDF could not be read">
            {error}
          </Alert>
        ) : null}

        {needsOcr && status !== 'busy' ? (
          <Alert tone="warning" title="This PDF has no selectable text">
            <p>
              The file looks like a scan or a photo, so the text cannot be read directly. The OCR engine can read the
              page anyway — it is part of the application and works on the rendered page.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void runOcr()} icon={<Sparkles className="h-4 w-4" />}>
                Read with OCR
              </Button>
              <Button variant="ghost" onClick={() => void reset()} icon={<X className="h-4 w-4" />}>
                Cancel
              </Button>
            </div>
          </Alert>
        ) : null}

        {status === 'done' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-700">
                  {rows.length === 0 ? (
                    'No value of the form was recognised.'
                  ) : (
                    <>
                      <span className="font-semibold text-ink-900">{rows.length}</span> value(s) found in{' '}
                      <span className="font-medium text-ink-900">{fileName}</span>.
                    </>
                  )}
                </p>
                {formatName ? (
                  <p className="mt-0.5 text-xs text-ink-500">
                    Standard format: <span className="font-medium text-ink-700">{formatName}</span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void reset()} icon={<RefreshCw className="h-4 w-4" />}>
                  Choose another PDF
                </Button>
                <Button
                  onClick={apply}
                  disabled={rows.length === 0 || selected.size === 0}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Fill the form
                </Button>
              </div>
            </div>

            {rows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-ink-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Use</th>
                      <th className="px-3 py-2 font-medium">Value read from the PDF</th>
                      <th className="px-3 py-2 font-medium">Written into</th>
                      <th className="px-3 py-2 font-medium">Page</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {rows.map((row) => (
                      <tr key={row.key} className="align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            checked={selected.has(row.key)}
                            onChange={(event) => {
                              setSelected((current) => {
                                const next = new Set(current);
                                if (event.target.checked) next.add(row.key);
                                else next.delete(row.key);
                                return next;
                              });
                            }}
                            aria-label={`Use the value of ${row.label}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <textarea
                            className="w-full resize-y rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-800 focus:border-brand-500 focus:outline-none"
                            rows={row.value.includes('\n') ? 3 : 1}
                            value={row.value}
                            onChange={(event) => editValue(row, event.target.value)}
                            aria-label={`Value read for ${row.label}`}
                          />
                          {row.warning ? (
                            <p className="mt-1 text-[11px] text-amber-700">{row.warning}</p>
                          ) : row.hint ? (
                            <p className="mt-1 text-[11px] text-amber-700">{row.hint}</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-ink-400">
                              “{row.matchedText}” on page {row.pageNumber}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="field-input py-1 text-xs"
                            value={row.key}
                            onChange={(event) => changeTarget(row, event.target.value)}
                            aria-label={`Field filled with the value of ${row.label}`}
                          >
                            {targets.map((target) => (
                              <option key={target.key} value={target.key}>
                                {target.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-ink-500">
                          {row.warning ? <Badge tone="warning">check</Badge> : row.pageNumber}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <p className="text-xs text-ink-500">
              Every value can be corrected here before it is written into the form. Values that could not be read
              reliably are skipped.
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
