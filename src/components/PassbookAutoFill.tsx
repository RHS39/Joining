import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cloud, CloudOff, ImageIcon, RefreshCw, Sparkles, Upload } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Alert } from './ui/Alert';
import { Badge } from './ui/Badge';
import { Spinner } from './ui/Spinner';
import { describeError } from '@/lib/errors';
import { ACCEPTED_IMAGE_EXTENSIONS, prepareImageForOcr } from '@/lib/image';
import { ocrImage } from '@/lib/ocr';
import { cloudMatches, cloudReaderState, CloudOcrError, readPassbookWithCloud } from '@/lib/cloudOcr';
import { readOcrQuota, useOcrQuota, type OcrQuota } from '@/lib/ocrQuota';
import { findPassbookField, parsePassbookText, PASSBOOK_TARGETS, type PassbookMatch } from '@/lib/passbook';
import type { FieldDefinition } from '@/types';

export interface PassbookAutoFillProps {
  /** The fields of the form — the bank details are written into them. */
  customFields: FieldDefinition[];
  /** Called with the values the user confirmed, keyed by `custom:<fieldKey>`. */
  onApply: (values: Record<string, string>) => void;
}

type Status = 'idle' | 'busy' | 'done' | 'error';

/** Where a value was read. */
type Reader = 'local' | 'cloud';

/** A value that was read, together with the field it is written into. */
interface PassbookRow {
  match: PassbookMatch;
  /** The field of the form — `undefined` when the form has no such field. */
  field?: FieldDefinition;
  /** True when the value is written into the form. */
  selected: boolean;
  /** The reader that found the value. */
  reader: Reader;
}

/** True when a value can be used as it is. */
function isReliable(row: PassbookRow): boolean {
  return Boolean(row.match.value.trim()) && !row.match.warning;
}

/**
 * The rows of the local reader and of the cloud reader in one table.
 *
 * A value of the cloud reader wins, because it is read more carefully. When
 * the two readers found different values, the user is told about it.
 */
function mergeRows(localRows: PassbookRow[], cloudRows: PassbookRow[]): PassbookRow[] {
  const merged = new Map(localRows.map((row) => [row.match.key, row]));

  cloudRows.forEach((cloud) => {
    const local = merged.get(cloud.match.key);
    const cloudValue = cloud.match.value.trim();

    if (!cloudValue) return;

    if (!local || !local.match.value.trim()) {
      merged.set(cloud.match.key, cloud);
      return;
    }

    if (local.match.value.trim() === cloudValue) {
      merged.set(cloud.match.key, { ...cloud, match: { ...cloud.match, warning: undefined } });
      return;
    }

    const warning = isReliable(local) && isReliable(cloud)
      ? `The photo was read twice: “${local.match.value.trim()}” and “${cloudValue}” — please check.`
      : cloud.match.warning;

    merged.set(cloud.match.key, { ...cloud, match: { ...cloud.match, warning } });
  });

  return PASSBOOK_TARGETS.map((target) => merged.get(target.key)).filter(
    (row): row is PassbookRow => Boolean(row),
  );
}

/**
 * "Auto-fill from a bank passbook": upload the photo of a passbook and read
 * the bank details out of it.
 *
 * The photo is read in this browser first. When that read is not good enough
 * and a cloud reader is deployed, the photo is sent to it — the values are
 * shown before they are written into the form either way.
 */
export function PassbookAutoFill({ customFields, onApply }: PassbookAutoFillProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<File | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [rows, setRows] = useState<PassbookRow[]>([]);
  const [holderName, setHolderName] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [cloudText, setCloudText] = useState('');
  const [cloudNotes, setCloudNotes] = useState('');
  const [cloudMessage, setCloudMessage] = useState<string | null>(null);
  const [quota, setQuota] = useState<OcrQuota | null>(null);

  const targets = useMemo(() => new Map(PASSBOOK_TARGETS.map((target) => [target.key, target])), []);

  const toRows = useCallback(
    (matches: PassbookMatch[], reader: Reader): PassbookRow[] =>
      matches.map((match) => {
        const target = targets.get(match.key);
        const field = target ? findPassbookField(customFields, target) : undefined;
        return { match, field, selected: Boolean(field), reader };
      }),
    [customFields, targets],
  );

  useEffect(() => {
    void readOcrQuota()
      .then(setQuota)
      .catch(() => undefined);
  }, []);

  /** Read the photo with the cloud reader. */
  const runCloud = useCallback(
    async (file: File) => {
      try {
        const before = await readOcrQuota();
        setQuota(before);

        if (!before.canUse) {
          setCloudMessage(
            `The limit of cloud reads is reached (${before.dayLimit} per day, ${before.monthLimit} per month). The photo was read in this browser.`,
          );
          return;
        }

        setStatus('busy');
        setProgress('Reading the photo with the cloud reader…');

        const outcome = await readPassbookWithCloud(file);
        setQuota(await useOcrQuota());
        setCloudMessage(null);
        setCloudText(outcome.data.raw_text.trim());
        setCloudNotes(outcome.data.notes.trim());

        const cloudRows = toRows(cloudMatches(outcome.data), 'cloud');
        setRows((current) => mergeRows(current, cloudRows));
        setHolderName((current) => current ?? (outcome.data.account_holder_name.trim() || null));
        setStatus('done');
      } catch (cause) {
        setCloudMessage(
          cause instanceof CloudOcrError ? cause.message : describeError(cause, 'The cloud reader could not be used.'),
        );
        setStatus('done');
      } finally {
        setProgress(null);
      }
    },
    [toRows],
  );

  /** True when the local read is not good enough to be trusted. */
  const needsCloud = useCallback((localRows: PassbookRow[]): boolean => {
    const byKey = new Map(localRows.map((row) => [row.match.key, row]));
    const account = byKey.get('bank_account_no');
    const ifsc = byKey.get('bank_ifsc_code');
    if (!account || !isReliable(account)) return true;
    if (!ifsc || !isReliable(ifsc)) return true;
    return false;
  }, []);

  const handleFile = async (file: File) => {
    setStatus('busy');
    setError(null);
    setRows([]);
    setHolderName(null);
    setOcrText('');
    setCloudText('');
    setCloudNotes('');
    setCloudMessage(null);
    setProgress('Preparing the photo…');
    setFileName(file.name);
    fileRef.current = file;

    try {
      const image = await prepareImageForOcr(file);
      setProgress('Reading the photo with OCR…');
      const text = await ocrImage(image, (state) => {
        setProgress(`${state.status} (${Math.round(state.progress * 100)} %)`);
      });
      setProgress(null);
      setOcrText(text);

      const read = parsePassbookText(text);
      setHolderName(read.holderName);

      const localRows = toRows(read.matches, 'local');
      setRows(localRows);
      setStatus('done');

      // The local reader often misreads a long number, so the cloud reader
      // is asked when the free read did not deliver a usable number.
      if (needsCloud(localRows) && cloudReaderState() !== 'missing') {
        await runCloud(file);
      }
    } catch (cause) {
      setProgress(null);
      setError(
        describeError(
          cause,
          'The passbook could not be read. Try a sharper photo of the page that carries the account number and the IFSC code.',
        ),
      );
      setStatus('error');
    }
  };

  const updateRow = (key: string, patch: Partial<PassbookRow>) => {
    setRows((current) => current.map((row) => (row.match.key === key ? { ...row, ...patch } : row)));
  };

  const apply = () => {
    const values: Record<string, string> = {};
    rows.forEach((row) => {
      if (!row.selected || !row.field) return;
      const value = row.match.value.trim();
      if (!value) return;
      values[`custom:${row.field.key}`] = value;
    });
    onApply(values);
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
    setRows([]);
    setHolderName(null);
    setOcrText('');
    setCloudText('');
    setCloudNotes('');
    setCloudMessage(null);
    setProgress(null);
    setFileName('');
    fileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const found = rows.length;
  const cloudUsed = rows.some((row) => row.reader === 'cloud');
  const readerMissing = cloudReaderState() === 'missing';

  return (
    <Card>
      <CardHeader
        title="Auto-fill from a bank passbook"
        description="Upload the photo of a passbook: the account number, the IFSC code, the bank and the branch are read out of it. The photo is read in this browser; when a cloud reader is deployed, it is sent there to be read more carefully."
      />
      <CardBody className="space-y-4">
        {status === 'idle' || status === 'error' ? (
          <label className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
            <ImageIcon className="h-9 w-9 text-ink-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-ink-800">{fileName || 'Choose the photo of a bank passbook'}</p>
            <p className="mt-1 text-xs text-ink-500">
              The page that carries the account number and the IFSC code is the best one. The photo is read in this
              browser — the OCR engine is part of the application, so it also works without an internet connection.
            </p>
            <span className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Select photo
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept={ACCEPTED_IMAGE_EXTENSIONS.join(',')}
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
            <Spinner label={progress ?? 'Reading the passbook…'} />
          </div>
        ) : null}

        {status === 'error' && error ? (
          <Alert tone="error" title="The passbook could not be read">
            {error}
          </Alert>
        ) : null}

        {status === 'done' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-ink-700">
                  {found === 0 ? (
                    'No bank detail was recognised.'
                  ) : (
                    <>
                      <span className="font-semibold text-ink-900">{found}</span> value(s) read from{' '}
                      <span className="font-medium text-ink-900">{fileName}</span>.
                    </>
                  )}
                </p>
                {holderName ? (
                  <p className="mt-0.5 text-xs text-ink-500">
                    Account holder: <span className="font-medium text-ink-700">{holderName}</span> — the form has no
                    field for it.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {fileRef.current && !readerMissing ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const file = fileRef.current;
                      if (file) void runCloud(file);
                    }}
                    disabled={!quota?.canUse}
                    icon={<Cloud className="h-4 w-4" />}
                  >
                    Read again with the cloud reader
                  </Button>
                ) : null}
                <Button variant="outline" onClick={reset} icon={<RefreshCw className="h-4 w-4" />}>
                  Choose another photo
                </Button>
                <Button onClick={apply} disabled={found === 0} icon={<Sparkles className="h-4 w-4" />}>
                  Fill the form
                </Button>
              </div>
            </div>

            {quota ? (
              <p className="text-xs text-ink-500">
                Cloud reads left: <span className="font-medium text-ink-700">{quota.dayRemaining}</span> today,{' '}
                <span className="font-medium text-ink-700">{quota.monthRemaining}</span> this month (
                {quota.dayLimit} per day, {quota.monthLimit} per month).
              </p>
            ) : null}

            {cloudMessage ? (
              <Alert tone="warning" title="The cloud reader was not used">
                {cloudMessage}
              </Alert>
            ) : null}

            {cloudNotes ? (
              <p className="text-xs text-ink-500">
                The cloud reader says: <span className="text-ink-700">{cloudNotes}</span>
              </p>
            ) : null}

            {rows.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-ink-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-ink-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">Use</th>
                      <th className="px-3 py-2 font-medium">Value read from the passbook</th>
                      <th className="px-3 py-2 font-medium">Written into</th>
                      <th className="px-3 py-2 font-medium">Read by</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {rows.map((row) => (
                      <tr key={row.match.key} className="align-top">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                            checked={row.selected}
                            disabled={!row.field}
                            onChange={(event) => updateRow(row.match.key, { selected: event.target.checked })}
                            aria-label={`Use the value of ${row.match.label}`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded-md border border-ink-200 px-2 py-1 text-xs text-ink-800 focus:border-brand-500 focus:outline-none"
                            value={row.match.value}
                            onChange={(event) =>
                              updateRow(row.match.key, {
                                match: { ...row.match, value: event.target.value, warning: undefined },
                              })
                            }
                            aria-label={`Value read for ${row.match.label}`}
                          />
                          {row.match.warning ? (
                            <p className="mt-1 text-[11px] text-amber-700">{row.match.warning}</p>
                          ) : row.reader === 'cloud' ? (
                            <p className="mt-1 text-[11px] text-ink-400">Read by the cloud reader.</p>
                          ) : (
                            <p className="mt-1 text-[11px] text-ink-400">“{row.match.matchedText}”</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.field ? (
                            <span className="text-ink-700">{row.field.label}</span>
                          ) : (
                            <Badge tone="warning">no field</Badge>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {row.reader === 'cloud' ? (
                            <Badge tone="brand">
                              <Cloud className="mr-1 inline h-3 w-3" aria-hidden="true" />
                              cloud
                            </Badge>
                          ) : (
                            <Badge tone="neutral">
                              <CloudOff className="mr-1 inline h-3 w-3" aria-hidden="true" />
                              this browser
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {ocrText || cloudText ? (
              <details className="rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-ink-600">The text that was read</summary>
                {ocrText ? (
                  <>
                    <p className="mt-2 text-[11px] font-medium text-ink-500">This browser</p>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-ink-600">{ocrText}</pre>
                  </>
                ) : null}
                {cloudText ? (
                  <>
                    <p className="mt-2 text-[11px] font-medium text-ink-500">The cloud reader</p>
                    <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-ink-600">{cloudText}</pre>
                  </>
                ) : null}
              </details>
            ) : null}

            <p className="text-xs text-ink-500">
              Every value can be corrected here before it is written into the form. The photo itself is not stored.
              {cloudUsed ? ' It was sent to the cloud reader to be read.' : ''}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
