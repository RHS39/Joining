/**
 * The standard format of the PDF forms the application reads.
 *
 * The reference document is the **e-Pehchan card of the Employees' State
 * Insurance Corporation (ESIC)** — the card an insured person gets from the
 * employer. It is printed as:
 *
 *   EMPLOYEES' STATE INSURANCE CORPORATION / e-Pehchan Card
 *
 *   PERSONAL DETAILS
 *     Name of IP : … | Insurance No. : …
 *     Date of Birth : … | UHID : …
 *     Gender : … | UAN : …
 *     Mobile Number : … | ABHA Number : …
 *     …
 *
 *   REGISTRATION DETAILS
 *     Marital Status : … | Name of Father / Husband : …
 *     Present Address : … | Permanent Address : …
 *
 *   CURRENT EMPLOYER DETAILS
 *     Employer's Code No. : … | Name of Employer : …
 *     Sub Unit's Code No. : … | Date of Appointment : …
 *     Address of Employer : … | Branch Office : …
 *
 *   FAMILY DETAILS      (a table — not read)
 *   NOMINEE DETAILS     (a table — not read)
 *
 * The blocks, the labels and the values that the card prints in another way
 * than the field allows them are described here, so that every PDF of this
 * structure fills the form the same way.
 */

/** A block of the form. */
export interface PdfFormatSection {
  /** Id of the block, used by the rules. */
  id: string;
  /** Names the block is printed under. */
  headings: string[];
  /** The block prints a table — its lines are not read as fields. */
  table?: boolean;
}

/** A label that is read in a block of the form. */
export interface PdfFormatRule {
  /** Block the label belongs to, `''` for the whole form. */
  section: string;
  /** Names of the label. */
  aliases: string[];
  /** Field the value is written to. */
  target: string;
}

/** The structure of a PDF form. */
export interface PdfFormat {
  /** Id of the format. */
  id: string;
  /** Name shown in the interface. */
  name: string;
  /** What the format is used for. */
  description: string;
  /** The blocks of the form. */
  sections: PdfFormatSection[];
  /** The labels that are read in a block of the form. */
  rules: PdfFormatRule[];
  /** Values the form prints in another way than the field allows them. */
  synonyms?: Record<string, Record<string, string>>;
  /** Patterns the value of a field has to match. */
  patterns?: Record<string, RegExp>;
}

/** The e-Pehchan card of the Employees' State Insurance Corporation. */
export const STANDARD_FORMAT: PdfFormat = {
  id: 'esic-pehchan',
  name: 'ESIC e-Pehchan card',
  description:
    'The insurance card of the Employees’ State Insurance Corporation: personal details, registration details, current employer details, family details and nominee details.',
  sections: [
    { id: 'personalDetails', headings: ['personal details'] },
    { id: 'registrationDetails', headings: ['registration details'] },
    { id: 'currentEmployer', headings: ['current employer details'] },
    {
      id: 'previousEmployer',
      headings: [
        'previous employer details',
        'previous employer',
        'previous employment details',
        'previous company details',
        'previous employment',
        'previous company',
      ],
    },
    { id: 'familyDetails', headings: ['family details'], table: true },
    { id: 'nomineeDetails', headings: ['nominee details'], table: true },
  ],
  rules: [
    // The joining date of the card is the date of the appointment.
    { section: 'currentEmployer', aliases: ['date of appointment', 'appointment date'], target: 'date' },
    // The current employer is the contractor of the joining form.
    { section: 'currentEmployer', aliases: ['name of employer', 'employer name'], target: 'custom:name_of_contractor' },
    { section: 'currentEmployer', aliases: ['name of contractor', 'contractor name'], target: 'custom:name_of_contractor' },
    // The contractor of the previous employer is the previous company.
    {
      section: 'previousEmployer',
      aliases: ['name of contractor', 'contractor name'],
      target: 'custom:previous_company_name',
    },
  ],
  synonyms: {
    // The card writes the marital status in its own words.
    'custom:marital_status': {
      unmarried: 'Single',
      single: 'Single',
      married: 'Married',
      widowed: 'Widowed',
      divorcee: 'Divorced',
    },
    'custom:gender': { m: 'Male', f: 'Female' },
    // The employer is written in different ways on the cards.
    'custom:name_of_contractor': {
      'kriss enterpriss': 'KRISS ENTERPRISES',
      'kriss enterprises': 'KRISS ENTERPRISES',
      'rohit enterpriss': 'ROHIT ENTERPRISES',
      'rohit enterprises': 'ROHIT ENTERPRISES',
    },
  },
  patterns: {
    // The card only prints whether the Aadhaar is verified, never the number.
    'custom:aadhar_card_number': /^\d{4}\s?\d{4}\s?\d{4}$/,
  },
};
