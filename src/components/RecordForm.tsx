import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RotateCcw, Save } from 'lucide-react';
import { getRecordByRecordId, generateUniqueRecordId } from '@/db/repository';
import { useSettings } from './SettingsContext';
import { useToast } from './ui/Toast';
import { Button } from './ui/Button';
import { Card, CardBody, CardHeader } from './ui/Card';
import { FieldShell, SelectInput, TextArea, TextInput } from './ui/Field';
import { ImageField, type ImagePreview } from './ImageField';
import { PassbookAutoFill } from './PassbookAutoFill';
import { PdfAutoFill } from './PdfAutoFill';
import { describeError } from '@/lib/errors';
import { groupFieldsBySection } from '@/lib/fields';
import { processImageFile, PHOTO_FRAME_HEIGHT, PHOTO_FRAME_WIDTH, type ProcessedImage } from '@/lib/image';
import { formatCurrency } from '@/lib/format';
import { recordFormSchema, toRecordInput, type RecordFormValues } from '@/lib/validation';
import { todayIsoDate } from '@/lib/id';
import { customFieldKeyFromColumn } from '@/lib/columns';
import { buildPdfTargets } from '@/lib/pdfMapping';
import { matchOption } from '@/lib/templates';
import type { DataRecord, ImageAttachment, RecordInput } from '@/types';

export interface RecordFormProps {
  mode: 'create' | 'edit';
  initial?: DataRecord | null;
  existingImage?: ImageAttachment | null;
  onSubmit: (input: RecordInput, image: ProcessedImage | null, removeImage: boolean) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export function RecordForm({
  mode,
  initial = null,
  existingImage = null,
  onSubmit,
  onCancel,
  submitLabel,
}: RecordFormProps) {
  const { settings } = useSettings();
  const { notify } = useToast();
  const customFields = settings.customFields;
  // Older stored preferences do not have the flag, the block is then shown.
  const showQuantities = settings.preferences.showQuantities !== false;

  const defaultValues = useMemo<RecordFormValues>(() => {
    const custom: Record<string, string> = {};
    for (const field of customFields) {
      const value = initial?.custom?.[field.key];
      custom[field.key] =
        value === null || value === undefined ? (field.defaultValue ?? '') : String(value);
    }
    // The category of a new employee: the one of the preferences, the first
    // one of the list when it is not part of it.
    const preferred = settings.preferences.defaultCategory;
    const defaultCategory = preferred && settings.categories.includes(preferred)
      ? preferred
      : (settings.categories[0] ?? '');
    return {
      recordId: initial?.recordId ?? '',
      date: initial?.date ?? todayIsoDate(),
      title: initial?.title ?? '',
      category: initial?.category ?? defaultCategory,
      description: initial?.description ?? '',
      quantity: initial?.quantity === null || initial?.quantity === undefined ? '' : String(initial.quantity),
      unitPrice: initial?.unitPrice === null || initial?.unitPrice === undefined ? '' : String(initial.unitPrice),
      custom,
    };
  }, [customFields, initial, settings.categories, settings.preferences.defaultCategory]);

  const schema = useMemo(() => recordFormSchema(customFields), [customFields]);
  const customSections = useMemo(() => groupFieldsBySection(customFields), [customFields]);
  const pdfTargets = useMemo(() => buildPdfTargets(customFields), [customFields]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecordFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onBlur',
  });

  const [pendingImage, setPendingImage] = useState<ProcessedImage | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const quantity = watch('quantity');
  const unitPrice = watch('unitPrice');
  const totalAmount = useMemo(() => {
    const q = Number(quantity);
    const p = Number(unitPrice);
    if (!quantity || !unitPrice || !Number.isFinite(q) || !Number.isFinite(p)) return null;
    return Math.round(q * p * 100) / 100;
  }, [quantity, unitPrice]);

  // Generate a unique Record ID for new records.
  useEffect(() => {
    if (mode !== 'create') return;
    let cancelled = false;
    generateUniqueRecordId().then((id) => {
      if (!cancelled) setValue('recordId', id);
    });
    return () => {
      cancelled = true;
    };
  }, [mode, setValue]);

  // Keep the custom field inputs in sync with the settings.
  useEffect(() => {
    const current = watch('custom') ?? {};
    customFields.forEach((field) => {
      if (!(field.key in current)) {
        setValue(`custom.${field.key}`, '');
      }
    });
  }, [customFields, setValue, watch]);

  const handleFile = async (file: File) => {
    setImageBusy(true);
    setImageError(null);
    try {
      const processed = await processImageFile(file);
      setPendingImage(processed);
      setRemoveImage(false);
    } catch (error) {
      setImageError(describeError(error, 'The image could not be processed.'));
    } finally {
      setImageBusy(false);
    }
  };

  const handleRemoveImage = () => {
    setPendingImage(null);
    setRemoveImage(true);
    setImageError(null);
  };

  const handleReset = () => {
    reset(defaultValues);
    setPendingImage(null);
    setRemoveImage(false);
    setImageError(null);
    clearErrors();
  };

  const regenerateId = async () => {
    const id = await generateUniqueRecordId();
    setValue('recordId', id, { shouldValidate: true, shouldDirty: true });
  };

  const onValid = async (values: RecordFormValues) => {
    const input = toRecordInput(values, customFields);

    const duplicate = await getRecordByRecordId(input.recordId);
    if (duplicate && duplicate.id !== initial?.id) {
      setError('recordId', { type: 'manual', message: 'An employee with this Employee ID already exists.' });
      return;
    }

    try {
      await onSubmit(input, pendingImage, removeImage && !pendingImage);
    } catch (error) {
      notify(describeError(error, 'The employee could not be saved.'), 'error');
    }
  };

  /** Write the values that were read from a PDF or a passbook into the form. */
  const applyExtractedValues = (values: Record<string, string>) => {
    let applied = 0;
    const skipped: string[] = [];

    Object.entries(values).forEach(([key, value]) => {
      const text = value.trim();
      if (!text) return;

      if (key.startsWith('custom:')) {
        const fieldKey = customFieldKeyFromColumn(key);
        const field = customFields.find((item) => item.key === fieldKey);
        if (!field) return;
        let value = text;
        if (field.type === 'select' && field.options?.length) {
          // A drop-down only takes one of its own options — the value of the
          // PDF is written the way the option is written.
          const option = matchOption(field.options, text);
          if (!option) {
            skipped.push(field.label);
            return;
          }
          value = option;
        }
        setValue(`custom.${fieldKey}` as const, value, { shouldDirty: true, shouldValidate: true });
        applied += 1;
        return;
      }

      if (key === 'category' && !settings.categories.includes(text)) {
        skipped.push('Category');
        return;
      }

      setValue(key as 'recordId' | 'date' | 'title' | 'category' | 'description', text, {
        shouldDirty: true,
        shouldValidate: true,
      });
      applied += 1;
    });

    if (applied > 0) notify(`${applied} field(s) filled.`, 'success');
    if (skipped.length > 0) {
      notify(`Not written: ${skipped.join(', ')} — the value is not an allowed one.`, 'warning');
    }
  };

  const preview: ImagePreview | null = pendingImage
    ? {
        blob: pendingImage.blob,
        fileName: pendingImage.fileName,
        size: pendingImage.size,
        width: pendingImage.width,
        height: pendingImage.height,
        originalSize: pendingImage.originalSize,
        originalWidth: pendingImage.originalWidth,
        originalHeight: pendingImage.originalHeight,
      }
    : existingImage && !removeImage
      ? {
          blob: existingImage.blob,
          fileName: existingImage.fileName,
          size: existingImage.size,
          width: existingImage.width,
          height: existingImage.height,
        }
      : null;

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-5">
      <PdfAutoFill targets={pdfTargets} onApply={applyExtractedValues} />
      <PassbookAutoFill customFields={customFields} onApply={applyExtractedValues} />

      <Card>
        <CardHeader
          title="Employee details"
          description="The Employee ID is the next number of the sequence (EMP-0138) and can be adjusted. It is the key used when importing spreadsheets."
        />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Employee ID"
              htmlFor="recordId"
              required
              error={errors.recordId?.message}
              hint="The next free number of the sequence, e.g. EMP-0138. Unique identifier used for imports, exports and reports."
            >
              <div className="flex gap-2">
                <input
                  id="recordId"
                  className={`field-input ${errors.recordId ? 'field-input-error' : ''}`}
                  {...register('recordId')}
                />
                <Button type="button" variant="outline" onClick={() => void regenerateId()} icon={<RotateCcw className="h-4 w-4" />}>
                  New
                </Button>
              </div>
            </FieldShell>

            <TextInput
              label="Date of Joining"
              type="date"
              required
              error={errors.date?.message}
              containerClassName="sm:col-span-1"
              {...register('date')}
            />

            <TextInput
              label="Employee Name"
              required
              error={errors.title?.message}
              placeholder="e.g. Ramesh Kumar Sharma"
              containerClassName="sm:col-span-2 lg:col-span-1"
              {...register('title')}
            />

            <SelectInput
              label="Category"
              required
              error={errors.category?.message}
              containerClassName="sm:col-span-2 lg:col-span-1"
              {...register('category')}
            >
              <option value="">Select a category…</option>
              {settings.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </SelectInput>

            <TextArea
              label="Remarks"
              error={errors.description?.message}
              placeholder="Optional notes about this employee"
              containerClassName="sm:col-span-2"
              className="min-h-[120px]"
              {...register('description')}
            />
          </div>
        </CardBody>
      </Card>

      {showQuantities ? (
        <Card>
          <CardHeader title="Quantities and amounts" description="Total amount is calculated automatically from quantity and unit price." />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextInput
                label="Quantity"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                error={errors.quantity?.message}
                placeholder="0"
                {...register('quantity')}
              />
              <TextInput
                label="Unit Price"
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                error={errors.unitPrice?.message}
                placeholder="0.00"
                {...register('unitPrice')}
              />
              <FieldShell label="Total Amount" hint="Quantity x unit price">
                <div className="field-input bg-ink-100 font-semibold text-ink-800">
                  {totalAmount === null ? '—' : formatCurrency(totalAmount, settings.preferences.currency)}
                </div>
              </FieldShell>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {customSections.length > 0 ? (
        <div className="space-y-5">
          {customSections.map((group) => (
            <Card key={group.section || 'details'}>
              <CardHeader
                title={group.section || 'Additional fields'}
                description={
                  group.section
                    ? 'Custom fields defined in Settings.'
                    : 'Custom fields defined in Settings.'
                }
              />
              <CardBody>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.fields.map((field) => {
                    const fieldError = errors.custom?.[field.key]?.message;
                    if (field.type === 'select') {
                      return (
                        <SelectInput
                          key={field.key}
                          label={field.label}
                          required={field.required}
                          error={fieldError}
                          {...register(`custom.${field.key}` as const)}
                        >
                          <option value="">Select…</option>
                          {(field.options ?? []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </SelectInput>
                      );
                    }
                    if (field.type === 'multiline') {
                      return (
                        <TextArea
                          key={field.key}
                          label={field.label}
                          required={field.required}
                          error={fieldError}
                          containerClassName="sm:col-span-2"
                          className="min-h-[80px]"
                          {...register(`custom.${field.key}` as const)}
                        />
                      );
                    }
                    return (
                      <TextInput
                        key={field.key}
                        label={field.label}
                        required={field.required}
                        error={fieldError}
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        step={field.type === 'number' ? 'any' : undefined}
                        {...register(`custom.${field.key}` as const)}
                      />
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Photo"
          description={`Photos are resized to ${PHOTO_FRAME_WIDTH} x ${PHOTO_FRAME_HEIGHT} pixels, cropped to fill the frame and compressed locally before they are stored in the browser database.`}
        />
        <CardBody>
          <ImageField
            preview={preview}
            hasExisting={Boolean(existingImage)}
            onFile={(file) => void handleFile(file)}
            onRemove={handleRemoveImage}
            error={imageError ?? undefined}
            busy={imageBusy}
          />
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={handleReset} icon={<RotateCcw className="h-4 w-4" />}>
          Reset
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" loading={isSubmitting} icon={<Save className="h-4 w-4" />}>
          {submitLabel ?? (mode === 'create' ? 'Save employee' : 'Save changes')}
        </Button>
      </div>
    </form>
  );
}
