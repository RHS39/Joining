/**
 * Field templates.
 *
 * A template is a ready-made set of user-defined fields. It lets a team switch
 * the data entry form over to a known document — for example the "New Joining
 * Form" of a plant — without typing every field in by hand.
 *
 * The built-in fields of a record (Employee ID, Date of Joining, Employee Name,
 * Category, Remarks, Photo) stay available in every template.
 */
import type { AppPreferences, FieldDefinition } from '@/types';

export interface FieldTemplate {
  /** Stable id of the template. */
  id: string;
  /** Name shown in the settings. */
  name: string;
  /** Short explanation of what the template is for. */
  description: string;
  /** The source document the fields were taken from. */
  source?: string;
  /** Custom field definitions, in the order of the source document. */
  fields: FieldDefinition[];
  /** Suggested values for the built-in `Category` field. */
  categories?: string[];
  /** Application preferences that fit the document. */
  preferences?: Partial<AppPreferences>;
}

/**
 * "New Joining Form" — personnel joining record.
 *
 * The complete field list of one employee record:
 *
 *   1  Name of Contractor          21 Bank Name
 *   2  Name of Unit                22 Bank Account No.
 *   3  Photo          (built-in)    23 Bank IFSC Code
 *   4  Face ID No.                  24 Bank Branch Name
 *   5  First Name                   25 Previous Company Name
 *   6  Middle Name                  26 Total Year of Experience
 *   7  Last Name                    27 PF No.
 *   8  Father Name                  28 ESIC No.
 *   9  Permanent Address            29 UAN No.
 *   10 Temporary Address            30 Date of Joining   (built-in)
 *   11 Date of Birth                31 Covid 1st Dose Date
 *   12 Gender                       32 Covid 2nd Dose Date
 *   13 Marital Status               33 Covid Vaccine Name
 *   14 Blood Group                  34 Category          (built-in)
 *   15 Aadhar Card Number           35 Grade
 *   16 Pan Card Number              36 Designation
 *   17 Education                    37 Division Name
 *   18 Self Contact no.             38 Department Name
 *   19 Emergency Contact Name       39 Sub Dept. Name
 *   20 Emergency Contact Mob. No.   40 Section Name
 *
 * "Photo", "Date of Joining" and "Category" are the built-in fields of the
 * application, so they are not repeated as custom fields.
 */
export const JOINING_FORM_TEMPLATE: FieldTemplate = {
  id: 'joining-form',
  name: 'New Joining Form',
  description:
    'Personnel joining record: personal information, emergency contact, bank details, statutory numbers, Covid-19 vaccination and employment details.',
  source: 'New Joining Form — PEFCO Foundry Division (Bhosari)',
  categories: ['Casual', 'Piece Rate'],
  // A joining form has no quantity or price.
  preferences: { showQuantities: false, defaultCategory: 'Casual' },
  fields: [
    // ---------------------------------------------------------- general
    {
      key: 'name_of_contractor',
      label: 'Name of Contractor',
      type: 'select',
      section: 'General',
      options: ['ROHIT ENTERPRISES', 'KRISS ENTERPRISES'],
      aliases: ['contractor name', 'contractor'],
    },
    {
      key: 'name_of_unit',
      label: 'Name of Unit',
      type: 'text',
      section: 'General',
      defaultValue: 'PEFCO FOUNDRY DIVISION (BHOSARI)',
      aliases: ['unit name', 'unit'],
    },

    // ------------------------------------------------ personal information
    {
      key: 'face_id_no',
      label: 'Face ID No.',
      type: 'text',
      section: 'Personal Information',
      aliases: ['face id no', 'face id number', 'face id'],
    },
    {
      key: 'first_name',
      label: 'First Name',
      type: 'text',
      section: 'Personal Information',
      required: true,
      aliases: ['first name', 'first name of the employee'],
    },
    { key: 'middle_name', label: 'Middle Name', type: 'text', section: 'Personal Information', aliases: ['middle name'] },
    { key: 'last_name', label: 'Last Name', type: 'text', section: 'Personal Information', aliases: ['last name', 'surname'] },
    {
      key: 'father_name',
      label: 'Father Name',
      type: 'text',
      section: 'Personal Information',
      aliases: ['father name', "father's name", 'name of father', 'name of father husband'],
    },
    {
      key: 'permanent_address',
      label: 'Permanent Address',
      type: 'multiline',
      section: 'Personal Information',
      aliases: ['permanent address', 'address'],
    },
    {
      key: 'temporary_address',
      label: 'Temporary Address',
      type: 'multiline',
      section: 'Personal Information',
      aliases: ['temporary address', 'current address', 'present address'],
    },
    {
      key: 'date_of_birth',
      label: 'Date of Birth',
      type: 'date',
      section: 'Personal Information',
      aliases: ['date of birth', 'birth date', 'dob'],
    },
    {
      key: 'gender',
      label: 'Gender',
      type: 'select',
      section: 'Personal Information',
      options: ['Male', 'Female', 'Other', 'Prefer not to say'],
      aliases: ['gender', 'sex'],
    },
    {
      key: 'marital_status',
      label: 'Marital Status',
      type: 'select',
      section: 'Personal Information',
      options: ['Single', 'Married', 'Divorced', 'Widowed'],
      aliases: ['marital status', 'marriage status'],
    },
    {
      key: 'blood_group',
      label: 'Blood Group',
      type: 'select',
      section: 'Personal Information',
      options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      aliases: ['blood group', 'blood group type'],
    },
    {
      key: 'aadhar_card_number',
      label: 'Aadhar Card Number',
      type: 'text',
      section: 'Personal Information',
      aliases: [
        'aadhar card number',
        'aadhaar card number',
        'aadhar number',
        'aadhar no',
        'aadhaar number',
        'aadhaar no',
        'aadhar',
        'aadhaar',
      ],
    },
    {
      key: 'pan_card_number',
      label: 'Pan Card Number',
      type: 'text',
      section: 'Personal Information',
      aliases: ['pan card number', 'pan number', 'pan no', 'pan'],
    },
    {
      key: 'education',
      label: 'Education',
      type: 'text',
      section: 'Personal Information',
      aliases: ['education', 'educational qualification', 'qualification'],
    },
    {
      key: 'self_contact_no',
      label: 'Self Contact no.',
      type: 'text',
      section: 'Personal Information',
      aliases: ['self contact no', 'self contact number', 'contact no', 'contact number', 'mobile no', 'mobile number'],
    },

    // -------------------------------------------------- emergency contact
    {
      key: 'emergency_contact_name',
      label: 'Emergency Contact Name',
      type: 'text',
      section: 'Emergency Contact',
      aliases: ['emergency contact name', 'emergency contact'],
    },
    {
      key: 'emergency_contact_mob_no',
      label: 'Emergency Contact Mob. No.',
      type: 'text',
      section: 'Emergency Contact',
      aliases: [
        'emergency contact mob no',
        'emergency contact number',
        'emergency mobile no',
        'emergency contact mobile number',
      ],
    },

    // ------------------------------------------------------ bank details
    { key: 'bank_name', label: 'Bank Name', type: 'text', section: 'Bank Details', aliases: ['bank name', 'bank'] },
    {
      key: 'bank_account_no',
      label: 'Bank Account No.',
      type: 'text',
      section: 'Bank Details',
      aliases: ['bank account no', 'bank account number', 'account no', 'account number'],
    },
    {
      key: 'bank_ifsc_code',
      label: 'Bank IFSC Code',
      type: 'text',
      section: 'Bank Details',
      aliases: ['bank ifsc code', 'ifsc code', 'ifsc'],
    },
    {
      key: 'bank_branch_name',
      label: 'Bank Branch Name',
      type: 'text',
      section: 'Bank Details',
      aliases: ['bank branch name', 'branch name', 'branch'],
    },

    // ----------------------------------------------- previous employment
    {
      key: 'previous_company_name',
      label: 'Previous Company Name',
      type: 'text',
      section: 'Previous Employment',
      aliases: ['previous company name', 'previous company', 'present company name', 'company name'],
    },
    {
      key: 'total_year_of_experience',
      label: 'Total Year of Experience',
      type: 'number',
      section: 'Previous Employment',
      aliases: [
        'total year of experience',
        'total years of experience',
        'total experience',
        'year of experience',
        'years of experience',
        'experience',
      ],
    },

    // ------------------------------------------------- statutory details
    { key: 'pf_no', label: 'PF No.', type: 'text', section: 'Statutory Details', aliases: ['pf no', 'pf number'] },
    {
      key: 'esic_no',
      label: 'ESIC No.',
      type: 'text',
      section: 'Statutory Details',
      // The paper form prints the insurance number under this name.
      aliases: ['esic no', 'esic number', 'insurance no', 'insurance number', 'insurance on', 'ip number', 'insurance'],
    },
    {
      key: 'uan_no',
      label: 'UAN No.',
      type: 'text',
      section: 'Statutory Details',
      // The paper form prints the number under the short name.
      aliases: ['uan no', 'uan number', 'uan'],
    },

    // ------------------------------------------------ covid-19 vaccination
    {
      key: 'covid_1st_dose_date',
      label: 'Covid 1st Dose Date',
      type: 'date',
      section: 'Covid Vaccination',
      aliases: ['covid 1st dose date', 'covid first dose date', '1st dose date', 'covid vaccination 1st dose date'],
    },
    {
      key: 'covid_2nd_dose_date',
      label: 'Covid 2nd Dose Date',
      type: 'date',
      section: 'Covid Vaccination',
      aliases: ['covid 2nd dose date', 'covid second dose date', '2nd dose date', 'covid vaccination 2nd dose date'],
    },
    {
      key: 'covid_vaccine_name',
      label: 'Covid Vaccine Name',
      type: 'select',
      section: 'Covid Vaccination',
      options: ['Covishield', 'Covaxin', 'Sputnik V', 'Other'],
      aliases: ['covid vaccine name', 'vaccine name', 'covid vaccine'],
    },

    // ----------------------------------------------- employment details
    { key: 'grade', label: 'Grade', type: 'text', section: 'Employment Details', aliases: ['grade'] },
    {
      key: 'designation',
      label: 'Designation',
      type: 'text',
      section: 'Employment Details',
      aliases: ['designation', 'job title', 'position'],
    },
    {
      key: 'division_name',
      label: 'Division Name',
      type: 'text',
      section: 'Employment Details',
      aliases: ['division name', 'division'],
    },
    {
      key: 'department_name',
      label: 'Department Name',
      type: 'text',
      section: 'Employment Details',
      aliases: ['department name', 'dept name', 'dept. name', 'department'],
    },
    {
      key: 'sub_department_name',
      label: 'Sub Dept. Name',
      type: 'text',
      section: 'Employment Details',
      aliases: ['sub dept name', 'sub dept. name', 'sub department name', 'sub department', 'sub dept'],
    },
    {
      key: 'section_name',
      label: 'Section Name',
      type: 'text',
      section: 'Employment Details',
      aliases: ['section name', 'section'],
    },
  ],
};

/** Compare two labels without the case and the surrounding spaces. */
function normaliseLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * The option of a drop-down that matches the value. The option itself is
 * returned, so the value that is written is always one of the allowed ones.
 */
export function matchOption(options: string[] | undefined, value: string): string | undefined {
  if (!options?.length) return undefined;
  const key = normaliseLabel(value);
  if (!key) return undefined;
  return options.find((option) => normaliseLabel(option) === key);
}

/** All templates that can be applied from the settings page. */
export const FIELD_TEMPLATES: FieldTemplate[] = [JOINING_FORM_TEMPLATE];

/**
 * The fields of the New Joining Form are the default data schema of the
 * application: a fresh install already carries the whole field list, so the
 * form, the exports, the importer and the reports work out of the box.
 *
 * A copy is returned on every call — the settings page edits the definitions
 * in place and must never mutate the shared template.
 */
export function createDefaultCustomFields(): FieldDefinition[] {
  return JOINING_FORM_TEMPLATE.fields.map((field) => ({
    ...field,
    options: field.options ? [...field.options] : undefined,
  }));
}

/** Find a template by its id. */
export function getFieldTemplate(id: string): FieldTemplate | undefined {
  return FIELD_TEMPLATES.find((template) => template.id === id);
}

/**
 * The fields that were renamed after the template was shipped. The key of a
 * field is the name its value is stored under, so a renamed field has to take
 * its values with it.
 */
export const RENAMED_FIELD_KEYS: Record<string, string> = {
  mother_name: 'father_name',
};

/** True when the stored fields still use a key that was renamed. */
export function hasRenamedField(fields: FieldDefinition[]): boolean {
  return fields.some((field) => field.key in RENAMED_FIELD_KEYS);
}

/**
 * The stored fields with the renamed keys applied: the field takes the key
 * and the definition of the template, the choices the user made for it (a
 * mandatory field, a pre-filled value) stay.
 */
export function applyRenamedFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.map((field) => {
    const newKey = RENAMED_FIELD_KEYS[field.key];
    if (!newKey) return field;

    const template = JOINING_FORM_TEMPLATE.fields.find((item) => item.key === newKey);
    if (!template) return { ...field, key: newKey };

    return {
      ...template,
      options: template.options ? [...template.options] : undefined,
      required: field.required ?? template.required,
      defaultValue: field.defaultValue ?? template.defaultValue,
    };
  });
}

/**
 * True when the stored fields are an older version of the shipped template:
 * the same fields, but with an outdated type, label or option list. The
 * categories of the template are checked as well.
 */
export function isOutdatedTemplate(fields: FieldDefinition[], categories: string[] = []): boolean {
  if (fields.length !== JOINING_FORM_TEMPLATE.fields.length) return false;

  const templateCategories = JOINING_FORM_TEMPLATE.categories ?? [];
  if (templateCategories.length > 0 && categories.join('|') !== templateCategories.join('|')) {
    return true;
  }

  const storedByKey = new Map(fields.map((field) => [field.key, field]));
  return JOINING_FORM_TEMPLATE.fields.some((field) => {
    const stored = storedByKey.get(field.key);
    if (!stored) return false;
    return (
      stored.type !== field.type ||
      stored.label !== field.label ||
      (stored.options ?? []).join('|') !== (field.options ?? []).join('|')
    );
  });
}
