import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileSpreadsheet, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useSettings } from '@/components/SettingsContext';
import { useToast } from '@/components/ui/Toast';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SelectInput, TextInput } from '@/components/ui/Field';
import { clearAllData, saveCategories, saveCustomFields, savePreferences } from '@/db/repository';
import { describeError } from '@/lib/errors';
import { FIELD_TEMPLATES, getFieldTemplate, isOutdatedTemplate } from '@/lib/templates';
import type { AppPreferences, CustomFieldType, FieldDefinition, Orientation, PageSize } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AED', 'SAR', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF', 'ZAR', 'BRL', 'NGN', 'KES'];

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'multiline', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select (list of options)' },
];

function toKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export default function SettingsPage() {
  const { settings, reload } = useSettings();
  const { notify } = useToast();

  const [preferences, setPreferences] = useState<AppPreferences>(settings.preferences);
  const [categories, setCategories] = useState<string[]>(settings.categories);
  const [newCategory, setNewCategory] = useState('');
  const [customFields, setCustomFields] = useState<FieldDefinition[]>(settings.customFields);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState('');
  const [fieldSection, setFieldSection] = useState('');
  const [templateToApply, setTemplateToApply] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPreferences(settings.preferences);
    setCategories(settings.categories);
    setCustomFields(settings.customFields);
  }, [settings]);

  const persist = async () => {
    setBusy(true);
    try {
      await savePreferences(preferences);
      await saveCategories(categories);
      await saveCustomFields(customFields);
      await reload();
      notify('Settings saved.', 'success');
    } catch (error) {
      notify(describeError(error, 'The settings could not be saved.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    if (categories.includes(value)) {
      notify('That category already exists.', 'warning');
      return;
    }
    setCategories((current) => [...current, value]);
    setNewCategory('');
  };

  const removeCategory = (category: string) => {
    setCategories((current) => current.filter((item) => item !== category));
  };

  const addField = () => {
    const label = fieldLabel.trim();
    if (!label) {
      notify('Please enter a label for the field.', 'warning');
      return;
    }
    let key = toKey(label);
    if (!key) key = `field_${customFields.length + 1}`;
    if (customFields.some((field) => field.key === key)) {
      notify('A field with this name already exists.', 'warning');
      return;
    }
    const options = fieldType === 'select'
      ? fieldOptions
          .split(',')
          .map((option) => option.trim())
          .filter(Boolean)
      : undefined;
    if (fieldType === 'select' && (!options || options.length === 0)) {
      notify('A select field needs at least one option.', 'warning');
      return;
    }
    setCustomFields((current) => [
      ...current,
      { key, label, type: fieldType, required: fieldRequired, options, section: fieldSection.trim() || undefined },
    ]);
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(false);
    setFieldOptions('');
    setFieldSection('');
  };

  const applyTemplate = () => {
    const template = templateToApply ? getFieldTemplate(templateToApply) : undefined;
    if (!template) return;
    setCustomFields(template.fields);
    if (template.categories?.length) {
      setCategories(template.categories);
    }
    if (template.preferences) {
      setPreferences((current) => ({ ...current, ...template.preferences }));
    }
    setTemplateToApply(null);
    notify(
      `${template.name} applied: ${template.fields.length} field(s) added. Save the settings to keep them.`,
      'success',
    );
  };

  const updateField = (key: string, patch: Partial<FieldDefinition>) => {
    setCustomFields((current) => current.map((field) => (field.key === key ? { ...field, ...patch } : field)));
  };

  const removeField = (key: string) => {
    setCustomFields((current) => current.filter((field) => field.key !== key));
  };

  const doClearAll = async () => {
    setBusy(true);
    try {
      await clearAllData();
      await reload();
      setClearOpen(false);
      notify('All local data was deleted from this browser.', 'success');
    } catch (error) {
      notify(describeError(error, 'The data could not be deleted.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Settings</h1>
          <p className="mt-1 text-sm text-ink-500">Categories, employee fields, templates and report defaults for this browser.</p>
        </div>
        <Button loading={busy} onClick={() => void persist()} icon={<Save className="h-4 w-4" />}>
          Save settings
        </Button>
      </header>

      <Card>
        <CardHeader title="Application" description="Used in the interface, in the exports and in the printed reports." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Application title"
            value={preferences.appTitle}
            onChange={(event) => setPreferences((current) => ({ ...current, appTitle: event.target.value }))}
          />
          <TextInput
            label="Organisation / sub-title"
            value={preferences.organisation}
            placeholder="e.g. Central store"
            onChange={(event) => setPreferences((current) => ({ ...current, organisation: event.target.value }))}
          />
          <SelectInput
            label="Currency"
            value={preferences.currency}
            onChange={(event) => setPreferences((current) => ({ ...current, currency: event.target.value }))}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </SelectInput>
          <TextInput
            label="Report footer note"
            value={preferences.footerNote}
            placeholder="e.g. Confidential — internal use only"
            onChange={(event) => setPreferences((current) => ({ ...current, footerNote: event.target.value }))}
          />
          <SelectInput
            label="Default paper size"
            value={preferences.defaultPageSize}
            onChange={(event) => setPreferences((current) => ({ ...current, defaultPageSize: event.target.value as PageSize }))}
          >
            <option value="A4">A4</option>
            <option value="Letter">US Letter</option>
          </SelectInput>
          <SelectInput
            label="Default orientation"
            value={preferences.defaultOrientation}
            onChange={(event) =>
              setPreferences((current) => ({ ...current, defaultOrientation: event.target.value as Orientation }))
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </SelectInput>
          <SelectInput
            label="Default category"
            value={preferences.defaultCategory}
            hint="The category that is pre-selected for a new employee."
            onChange={(event) =>
              setPreferences((current) => ({ ...current, defaultCategory: event.target.value }))
            }
          >
            <option value="">— the first one of the list —</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectInput>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={preferences.showImagesInReports}
                onChange={(event) =>
                  setPreferences((current) => ({ ...current, showImagesInReports: event.target.checked }))
                }
              />
              Show photos in reports by default
            </label>
            <label className="flex items-center gap-2 text-sm text-ink-700 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={preferences.showQuantities !== false}
                onChange={(event) =>
                  setPreferences((current) => ({ ...current, showQuantities: event.target.checked }))
                }
              />
              Show the quantity, unit price and total amount fields in the data entry form (not needed for a personnel register)
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Categories"
          description="Categories are offered in the data entry form, the filters, the exports and the imports."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-ink-50 py-1 pl-3 pr-1 text-sm text-ink-700"
              >
                {category}
                <button
                  type="button"
                  onClick={() => removeCategory(category)}
                  className="rounded-full p-0.5 text-ink-400 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove category ${category}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {categories.length === 0 ? <p className="text-sm text-ink-500">No categories yet.</p> : null}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <TextInput
              label="New category"
              value={newCategory}
              placeholder="e.g. Vehicles"
              containerClassName="w-64"
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCategory();
                }
              }}
            />
            <Button variant="outline" onClick={addCategory} icon={<Plus className="h-4 w-4" />}>
              Add
            </Button>
          </div>
          <p className="text-xs text-ink-500">
            Removing a category does not delete the records that use it — those records keep their current value.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Field templates"
          description="Apply a ready-made set of fields taken from a standard document. Applying a template replaces the current custom fields."
        />
        <CardBody className="space-y-3">
          {FIELD_TEMPLATES.map((template) => (
            <div key={template.id} className="rounded-lg border border-ink-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <FileSpreadsheet className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    {template.name}
                  </p>
                  <p className="mt-1 text-xs text-ink-600">{template.description}</p>
                  {template.source ? (
                    <p className="mt-0.5 text-xs italic text-ink-500">Source: {template.source}</p>
                  ) : null}
                  <p className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">{template.fields.length} fields</Badge>
                    {Array.from(new Set(template.fields.map((field) => field.section).filter(Boolean))).map((section) => (
                      <Badge key={section}>{section}</Badge>
                    ))}
                  </p>
                  {isOutdatedTemplate(customFields, categories) ? (
                    <p className="mt-2 text-xs font-medium text-amber-700">
                      The template was updated — apply it to get the current fields and categories.
                    </p>
                  ) : null}
                </div>
                <Button variant="outline" onClick={() => setTemplateToApply(template.id)} icon={<Plus className="h-4 w-4" />}>
                  Apply template
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-ink-500">
            The built-in fields (Employee ID, Date of Joining, Employee Name, Category, Remarks, Photo) always stay
            available. The photo field is used for the photo of the paper form, the category field for the category of
            the employment block.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Employee fields"
          description="Extra fields are rendered in the data entry form, the spreadsheet export/import and the employee card report."
        />
        <CardBody className="space-y-4">
          {customFields.length === 0 ? (
            <p className="text-sm text-ink-500">No employee fields defined yet.</p>
          ) : (
            <ul className="space-y-3">
              {customFields.map((field) => (
                <li key={field.key} className="rounded-lg border border-ink-200 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900">
                        {field.label} <span className="font-mono text-xs text-ink-500">({field.key})</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {FIELD_TYPES.find((type) => type.value === field.type)?.label}
                        {field.required ? ' · required' : ''}
                        {field.options?.length ? ` · ${field.options.join(', ')}` : ''}
                      </p>
                    </div>
                    {field.section ? <Badge tone="brand">{field.section}</Badge> : null}
                    <Badge>{field.type}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => removeField(field.key)}
                      icon={<Trash2 className="h-4 w-4" />}
                    >
                      Remove
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <TextInput
                      label="Section"
                      value={field.section ?? ''}
                      placeholder="e.g. Personal Information"
                      onChange={(event) =>
                        updateField(field.key, { section: event.target.value.trim() || undefined })
                      }
                    />
                    {field.type === 'select' ? (
                      <TextInput
                        label="Options (comma separated)"
                        value={(field.options ?? []).join(', ')}
                        onChange={(event) =>
                          updateField(field.key, {
                            options: event.target.value
                              .split(',')
                              .map((option) => option.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-lg border border-dashed border-ink-300 p-3">
            <p className="text-sm font-medium text-ink-800">Add a field</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <TextInput
                label="Label"
                value={fieldLabel}
                placeholder="e.g. Vendor"
                onChange={(event) => setFieldLabel(event.target.value)}
              />
              <SelectInput label="Type" value={fieldType} onChange={(event) => setFieldType(event.target.value as CustomFieldType)}>
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </SelectInput>
              <TextInput
                label="Options (only for select)"
                value={fieldOptions}
                placeholder="A, B, C"
                disabled={fieldType !== 'select'}
                onChange={(event) => setFieldOptions(event.target.value)}
              />
              <TextInput
                label="Section (optional)"
                value={fieldSection}
                placeholder="e.g. Bank Details"
                onChange={(event) => setFieldSection(event.target.value)}
              />
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 pb-2 text-sm text-ink-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                    checked={fieldRequired}
                    onChange={(event) => setFieldRequired(event.target.checked)}
                  />
                  Required
                </label>
                <Button variant="outline" onClick={addField} icon={<Plus className="h-4 w-4" />}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Privacy and storage" description="Everything happens locally in this browser." />
        <CardBody className="space-y-4">
          <Alert tone="info" title="Data location">
            Records and images are stored in this browser&apos;s IndexedDB. They belong to this browser profile on this
            device: they are not synchronised to a server, not shared with other browsers and not visible on another
            device. Clearing the site data, using a private window or uninstalling the browser removes them.
          </Alert>
          <Alert tone="warning" title="Not a secure vault">
            Browser storage is not encrypted at the application level. Anyone with access to this device and browser
            profile can read the data. Do not store highly sensitive or regulated information here.
          </Alert>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => setClearOpen(true)} className="text-red-600" icon={<Trash2 className="h-4 w-4" />}>
              Delete all local data
            </Button>
            <Link to="/data" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Backups are available in Import / Export
            </Link>
          </div>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(templateToApply)}
        title="Apply the field template"
        busy={busy}
        confirmLabel="Apply template"
        message={
          <>
            <p>
              The custom fields will be replaced by the fields of the template
              {templateToApply ? ` “${getFieldTemplate(templateToApply)?.name ?? ''}”` : ''}. Fields that are removed keep
              their stored values in the existing records, but they are no longer shown, exported or printed.
            </p>
            <p>The suggested categories and the matching application preferences are applied as well.</p>
            <p>Remember to press “Save settings” afterwards.</p>
          </>
        }
        onCancel={() => setTemplateToApply(null)}
        onConfirm={applyTemplate}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Delete all local data"
        destructive
        busy={busy}
        confirmLabel="Delete everything"
        message={
          <>
            <p>Every employee record, photo, category and setting stored in this browser will be permanently deleted.</p>
            <p>Download a full backup first if you might need the data again.</p>
          </>
        }
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void doClearAll()}
      />
    </div>
  );
}
