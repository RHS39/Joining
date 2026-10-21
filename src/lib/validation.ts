/**
 * Zod validation schemas shared by the data entry form, the edit dialog and the
 * spreadsheet importer — one source of truth for every rule.
 *
 * Two shapes exist on purpose:
 *  - `recordFormSchema` validates the raw string values of the HTML form.
 *  - `baseRecordSchema` validates already typed values (used by the importer).
 * Both reuse the very same rule fragments, so the rules cannot drift apart.
 */
import { z } from 'zod';
import type { FieldDefinition } from '@/types';

/** True when the string is a real calendar date in `YYYY-MM-DD` form. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** True when the text can be read as a finite, non negative number. */
export function isNonNegativeNumber(value: string): boolean {
  if (value.trim() === '') return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0;
}

/* ------------------------------------------------------------ rule pieces */

export const recordIdRule = z
  .string()
  .trim()
  .min(3, 'Employee ID must be at least 3 characters')
  .max(64, 'Employee ID must be 64 characters or fewer')
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, 'Use letters, numbers, dot, dash or underscore only');

export const dateRule = z
  .string()
  .trim()
  .min(1, 'Date of joining is required')
  .refine(isValidIsoDate, 'Enter a valid date (YYYY-MM-DD)');

export const titleRule = z
  .string()
  .trim()
  .min(1, 'Employee name is required')
  .max(200, 'Employee name must be 200 characters or fewer');

export const categoryRule = z
  .string()
  .trim()
  .min(1, 'Category is required')
  .max(64, 'Category must be 64 characters or fewer');

export const descriptionRule = z.string().max(4000, 'Remarks must be 4000 characters or fewer');

export const quantityRule = z
  .number({ invalid_type_error: 'Quantity must be a number' })
  .min(0, 'Quantity cannot be negative')
  .max(1_000_000, 'Quantity must be 1,000,000 or less')
  .nullable();

export const unitPriceRule = z
  .number({ invalid_type_error: 'Unit price must be a number' })
  .min(0, 'Unit price cannot be negative')
  .max(1_000_000_000, 'Unit price must be 1,000,000,000 or less')
  .nullable();

/* ---------------------------------------------------------- custom fields */

type CustomValue = string | number | boolean | null | undefined;

/**
 * Validate the user defined fields. Works for both the string based form values
 * and the typed values coming from an import.
 */
export function applyCustomFieldChecks(
  customFields: FieldDefinition[],
  getValue: (key: string) => CustomValue,
  ctx: z.RefinementCtx,
): void {
  for (const field of customFields) {
    const value = getValue(field.key);
    const path = ['custom', field.key];
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '');

    if (isEmpty) {
      if (field.required) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field.label} is required` });
      }
      continue;
    }

    switch (field.type) {
      case 'number': {
        const numeric = typeof value === 'number' ? value : Number(String(value).trim());
        if (!Number.isFinite(numeric)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field.label} must be a number` });
        } else if (numeric < 0) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field.label} cannot be negative` });
        }
        break;
      }
      case 'date': {
        if (typeof value !== 'string' || !isValidIsoDate(value.trim())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field.label} must be a valid date (YYYY-MM-DD)` });
        }
        break;
      }
      case 'multiline': {
        if (typeof value === 'string' && value.trim().length > 4000) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `${field.label} must be 4000 characters or fewer` });
        }
        break;
      }
      case 'select': {
        const options = field.options ?? [];
        if (options.length > 0 && !options.includes(String(value))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: `${field.label} must be one of: ${options.join(', ')}`,
          });
        }
        break;
      }
      default:
        break;
    }
  }
}

/* -------------------------------------------------------- typed (domain) */

/** Schema for already typed values (used by the spreadsheet importer). */
export function buildRecordSchema(customFields: FieldDefinition[] = []) {
  return z
    .object({
      recordId: recordIdRule,
      date: dateRule,
      title: titleRule,
      category: categoryRule,
      description: descriptionRule,
      quantity: quantityRule,
      unitPrice: unitPriceRule,
      custom: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
    })
    .superRefine((data, ctx) => {
      applyCustomFieldChecks(customFields, (key) => data.custom?.[key], ctx);
    });
}

export type BaseRecordValues = z.infer<ReturnType<typeof buildRecordSchema>>;

/* ---------------------------------------------------------- form (string) */

/** Raw values of the HTML form. */
export type RecordFormValues = {
  recordId: string;
  date: string;
  title: string;
  category: string;
  description: string;
  quantity: string;
  unitPrice: string;
  custom: Record<string, string>;
};

/** Schema for the raw string values of the form. */
export function recordFormSchema(customFields: FieldDefinition[] = []) {
  return z
    .object({
      recordId: recordIdRule,
      date: dateRule,
      title: titleRule,
      category: categoryRule,
      description: descriptionRule,
      quantity: z
        .string()
        .refine((value) => value.trim() === '' || isNonNegativeNumber(value), 'Quantity must be a number')
        .refine((value) => value.trim() === '' || Number(value) <= 1_000_000, 'Quantity must be 1,000,000 or less'),
      unitPrice: z
        .string()
        .refine((value) => value.trim() === '' || isNonNegativeNumber(value), 'Unit price must be a number')
        .refine((value) => value.trim() === '' || Number(value) <= 1_000_000_000, 'Unit price must be 1,000,000,000 or less'),
      custom: z.record(z.string()),
    })
    .superRefine((data, ctx) => {
      applyCustomFieldChecks(customFields, (key) => data.custom?.[key], ctx);
    });
}

/** Convert the raw form values into the typed domain input. */
export function toRecordInput(values: RecordFormValues, customFields: FieldDefinition[] = []) {
  const custom: Record<string, string | number | boolean | null> = {};
  for (const field of customFields) {
    const raw = (values.custom ?? {})[field.key];
    const text = (raw ?? '').toString().trim();
    if (text === '') {
      custom[field.key] = null;
      continue;
    }
    if (field.type === 'number') {
      const numeric = Number(text);
      custom[field.key] = Number.isFinite(numeric) ? numeric : text;
      continue;
    }
    custom[field.key] = text;
  }

  const quantity = values.quantity.trim() === '' ? null : Number(values.quantity);
  const unitPrice = values.unitPrice.trim() === '' ? null : Number(values.unitPrice);

  return {
    recordId: values.recordId.trim(),
    date: values.date.trim(),
    title: values.title.trim(),
    category: values.category.trim(),
    description: (values.description ?? '').trim(),
    quantity: quantity === null || Number.isNaN(quantity) ? null : quantity,
    unitPrice: unitPrice === null || Number.isNaN(unitPrice) ? null : unitPrice,
    custom,
  };
}

/** Format a Zod error map into `field -> message` pairs. */
export function zodIssuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  error.issues.forEach((issue) => {
    const key = issue.path.join('.');
    if (!key) return;
    if (!result[key]) result[key] = issue.message;
  });
  return result;
}
