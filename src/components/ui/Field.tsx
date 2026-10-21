import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';

export interface FieldShellProps {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Build a DOM id from a field label, e.g. `Title / Name` -> `input-title-name`.
 * Leading and trailing separators are removed so that a label ending with a
 * dot ("PF No.") does not produce an id ending with a dash.
 */
function toInputId(prefix: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug ? `${prefix}-${slug}` : prefix;
}

export function FieldShell({ label, htmlFor, error, hint, required, className, children }: FieldShellProps) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, hint, containerClassName, className, id, required, ...rest },
  ref,
) {
  const inputId = id ?? toInputId('input', label);
  return (
    <FieldShell label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={containerClassName}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cx('field-input', error && 'field-input-error', className)}
        {...rest}
      />
    </FieldShell>
  );
});

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { label, error, hint, containerClassName, className, id, required, children, ...rest },
  ref,
) {
  const inputId = id ?? toInputId('select', label);
  return (
    <FieldShell label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={containerClassName}>
      <select
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cx('field-input', error && 'field-input-error', className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, hint, containerClassName, className, id, required, ...rest },
  ref,
) {
  const inputId = id ?? toInputId('textarea', label);
  return (
    <FieldShell label={label} htmlFor={inputId} error={error} hint={hint} required={required} className={containerClassName}>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cx('field-input min-h-[96px] resize-y', error && 'field-input-error', className)}
        {...rest}
      />
    </FieldShell>
  );
});
