/**
 * The "New Joining Form" — the paper form of PEFCO Foundry Division (Bhosari).
 *
 * The layout of the form is reproduced exactly: the seven column grid, the
 * merged cells, the row numbers of the paper form, the empty areas and the
 * position of the photo. The values of the employee are written into the cells
 * of the form — nothing else is printed, no employee id, no time of print and
 * no remarks.
 */
import { useObjectUrl } from '@/hooks/useImages';
import { formatDate } from '@/lib/format';
import type { DataRecord, ImageAttachment } from '@/types';

export interface EmployeeJoiningFormProps {
  record: DataRecord;
  image?: ImageAttachment;
  /** Fallback for the "Name of Unit" cell. */
  organisation: string;
}

/** The photo of the form — a box in the top right corner of the form. */
function FormPhoto({ attachment, alt }: { attachment?: ImageAttachment; alt: string }) {
  const url = useObjectUrl(attachment?.blob);

  if (!attachment) {
    return <span className="jf-photo-text">Photo</span>;
  }

  if (!url) {
    return <div className="jf-photo-blank" />;
  }

  return <img src={url} alt={alt} className="form-photo" />;
}

/**
 * A space after every comma. The values are typed without spaces
 * (`Patel,Rampur,Boraki`), the paper form separates the parts with a space.
 */
function withCommaSpace(value: string): string {
  return value.replace(/,(?=\S)/g, ', ');
}

/**
 * Split a value into the lines of the paper form. A value that carries its own
 * line breaks keeps them, every other value is spread over the lines of the
 * box, the way the address is written on the paper form.
 */
function splitIntoLines(value: string, count: number): string[] {
  const text = value.trim();
  if (!text) return new Array<string>(count).fill('');

  const parts = text
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= count) return parts.slice(0, count);

  const words = parts.join(' ').split(/\s+/).filter(Boolean);
  const target = Math.ceil(words.join(' ').length / count);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const tooLong = current.length + 1 + word.length > target;
    if (current && tooLong && lines.length < count - 1) {
      lines.push(current);
      current = word;
      return;
    }
    current = current ? `${current} ${word}` : word;
  });

  lines.push(current);
  while (lines.length < count) lines.push('');
  return lines.slice(0, count);
}

export function EmployeeJoiningForm({ record, image, organisation }: EmployeeJoiningFormProps) {
  const custom = record.custom ?? {};

  /** The value of a user defined field of the employee. */
  const text = (key: string): string => {
    const raw = custom[key];
    if (raw === null || raw === undefined || raw === '') return '';
    return withCommaSpace(String(raw));
  };

  /** The value of a date field, written the way the form prints it. */
  const date = (key: string): string => {
    const raw = text(key);
    return raw ? formatDate(raw) : '';
  };

  /** A cell with a prompt and the value of the employee behind it. */
  const pair = (prompt: string, value: string) => (
    <span className="jf-pair">
      <span className="jf-bold">{prompt}</span>
      {value ? <span className="jf-value">{value}</span> : null}
    </span>
  );

  const permanentAddress = splitIntoLines(text('permanent_address'), 3);
  const temporaryAddress = splitIntoLines(text('temporary_address'), 3);

  return (
    <table className="joining-form">
      <colgroup>
        <col style={{ width: '4.48%' }} />
        <col style={{ width: '29%' }} />
        <col style={{ width: '7.28%' }} />
        <col style={{ width: '29.6%' }} />
        <col style={{ width: '8.74%' }} />
        <col style={{ width: '11.55%' }} />
        <col style={{ width: '9.35%' }} />
      </colgroup>
      <tbody>
        {/* ------------------------------------------------------------ title */}
        <tr className="jf-r-title">
          <th colSpan={7} className="jf-title-text">
            New Joining Form
          </th>
        </tr>

        {/* --------------------------------------------------------- general */}
        <tr className="jf-r-top">
          <th colSpan={2} className="jf-top-text">
            Name of Contractor :
          </th>
          <td colSpan={5} className="jf-top-value">
            {text('name_of_contractor')}
          </td>
        </tr>
        <tr className="jf-r-top">
          <th colSpan={2} className="jf-top-text">
            Name of Unit :
          </th>
          <td colSpan={5} className="jf-top-text">
            {text('name_of_unit') || organisation}
          </td>
        </tr>

        {/* --------------------------------------------- personal information */}
        <tr className="jf-r-head">
          <th className="jf-sr-text">
            Sr.
            <br />
            No.
          </th>
          <th colSpan={4} className="jf-head-text">
            Personal Information
          </th>
          <th rowSpan={6} colSpan={2} className="jf-photo-cell">
            <FormPhoto attachment={image} alt={`Photo of ${record.title}`} />
          </th>
        </tr>
        <tr className="jf-r-name">
          <th className="jf-sr-text">1</th>
          <th className="jf-bold">Face ID No.</th>
          <td colSpan={3}>{text('face_id_no')}</td>
        </tr>
        <tr className="jf-r-name">
          <th className="jf-sr-text">2</th>
          <th className="jf-bold">First Name</th>
          <td colSpan={3}>{text('first_name')}</td>
        </tr>
        <tr className="jf-r-name">
          <th className="jf-sr-text">3</th>
          <th className="jf-bold">Middle Name</th>
          <td colSpan={3}>{text('middle_name')}</td>
        </tr>
        <tr className="jf-r-name">
          <th className="jf-sr-text">4</th>
          <th className="jf-bold">Last Name</th>
          <td colSpan={3}>{text('last_name')}</td>
        </tr>
        <tr className="jf-r-slim">
          <th className="jf-sr-text">5</th>
          <th className="jf-bold">Father Name</th>
          <td colSpan={3}>{text('father_name')}</td>
        </tr>

        {/* -------------------------------------------------------- addresses */}
        <tr className="jf-r-line">
          <th rowSpan={3} className="jf-sr-text">
            6
          </th>
          <th rowSpan={3} className="jf-bold">Permanent Address</th>
          <td colSpan={5}>{permanentAddress[0]}</td>
        </tr>
        <tr className="jf-r-line">
          <td colSpan={5}>{permanentAddress[1]}</td>
        </tr>
        <tr className="jf-r-line">
          <td colSpan={5}>{permanentAddress[2]}</td>
        </tr>
        <tr className="jf-r-line">
          <th rowSpan={3} className="jf-sr-text">
            7
          </th>
          <th rowSpan={3} className="jf-bold">Temporary Address</th>
          <td colSpan={5}>{temporaryAddress[0]}</td>
        </tr>
        <tr className="jf-r-line">
          <td colSpan={5}>{temporaryAddress[1]}</td>
        </tr>
        <tr className="jf-r-line">
          <td colSpan={5}>{temporaryAddress[2]}</td>
        </tr>

        {/* ------------------------------------------------- personal details */}
        <tr className="jf-r-row">
          <th className="jf-sr-text">8</th>
          <th className="jf-bold">Date of Birth</th>
          <td colSpan={2}>{date('date_of_birth')}</td>
          <td colSpan={3}>{pair('Gender', text('gender'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">10</th>
          <th className="jf-bold">Marital Status</th>
          <td colSpan={2}>{text('marital_status')}</td>
          <td colSpan={3}>{pair('Blood Group -', text('blood_group'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">11</th>
          <th className="jf-bold">Aadhar Card Number</th>
          <td colSpan={2}>{text('aadhar_card_number')}</td>
          <td colSpan={3}>{pair('Pan Card Number', text('pan_card_number'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">12</th>
          <th className="jf-bold">Education</th>
          <td colSpan={2}>{text('education')}</td>
          <td colSpan={3} className="jf-spread">{pair('Self Contact no.', text('self_contact_no'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">13</th>
          <th className="jf-bold">Emergency Contact Person-</th>
          <td colSpan={2}>{pair('Name-', text('emergency_contact_name'))}</td>
          <td colSpan={3}>{pair('Mob. No.', text('emergency_contact_mob_no'))}</td>
        </tr>

        {/* ----------------------------------------------------- bank details */}
        <tr className="jf-r-row">
          <th className="jf-sr-text">14</th>
          <th className="jf-bold">Bank Name</th>
          <td colSpan={5}>{text('bank_name')}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">15</th>
          <th className="jf-bold">Bank Account No.</th>
          <td colSpan={2}>{text('bank_account_no')}</td>
          <td colSpan={3}>{pair('Bank IFSC Code', text('bank_ifsc_code'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">17</th>
          <th className="jf-bold">Bank Branch Name</th>
          <td colSpan={5}>{text('bank_branch_name')}</td>
        </tr>

        {/* ----------------------------------------------- previous employment */}
        <tr className="jf-r-row">
          <th className="jf-sr-text">18</th>
          <th className="jf-bold">Previous Company Name</th>
          <td colSpan={5}>{text('previous_company_name')}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">19</th>
          <th className="jf-bold">Total Year of Experience</th>
          <td colSpan={5}>{text('total_year_of_experience')}</td>
        </tr>

        {/* ------------------------------------------------- statutory details */}
        <tr className="jf-r-row">
          <th className="jf-sr-text">20</th>
          <th className="jf-bold">PF No.</th>
          <td colSpan={2}>{text('pf_no')}</td>
          <td colSpan={3} className="jf-spread">{pair('ESIC No.', text('esic_no'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">21</th>
          <th className="jf-bold">UAN No.</th>
          <td colSpan={2}>{text('uan_no')}</td>
          <td colSpan={3}>{pair('Date of Joining', record.date ? formatDate(record.date) : '')}</td>
        </tr>

        {/* ------------------------------------------------ covid-19 vaccine */}
        <tr className="jf-r-row">
          <th className="jf-sr-text">22</th>
          <th className="jf-bold">Covid -19 Vaccination History</th>
          <td colSpan={2}>{pair('1st Dose Date -', date('covid_1st_dose_date'))}</td>
          <td colSpan={3}>{pair('2nd Dose Date-', date('covid_2nd_dose_date'))}</td>
        </tr>
        <tr className="jf-r-wrap">
          <th className="jf-sr-text">23</th>
          <th className="jf-bold">Covid Vaccine Name (Covishield / Covaccine)</th>
          <td colSpan={5}>{text('covid_vaccine_name')}</td>
        </tr>

        {/* --------------------------------------------------------- signatures */}
        <tr className="jf-r-sign">
          <th colSpan={2} className="jf-sign-cell jf-sign-cell-first">
            <span className="jf-bold">Employee Sign</span>
          </th>
          <th colSpan={2} className="jf-sign-cell jf-sign-cell-middle">
            <span className="jf-bold">Sup. Sign</span>
          </th>
          <th colSpan={3} className="jf-sign-cell jf-sign-cell-last">
            <span className="jf-bold">HR Dept.</span>
          </th>
        </tr>
        <tr className="jf-r-sign-gap">
          <td colSpan={7} />
        </tr>

        {/* ----------------------------------------------- employment details */}
        <tr className="jf-r-row">
          <th className="jf-sr-text">24</th>
          <th className="jf-bold">Category</th>
          <td colSpan={2}>{record.category}</td>
          <td colSpan={3}>{pair('Grade', text('grade'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">25</th>
          <th className="jf-bold">Designation</th>
          <td colSpan={2}>{text('designation')}</td>
          <td colSpan={3}>{pair('Division Name', text('division_name'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">26</th>
          <th className="jf-bold">Department Name</th>
          <td colSpan={2}>{text('department_name')}</td>
          <td colSpan={3}>{pair('Sub Dept. Name', text('sub_department_name'))}</td>
        </tr>
        <tr className="jf-r-row">
          <th className="jf-sr-text">27</th>
          <th className="jf-bold">Section Name</th>
          <td colSpan={2}>{text('section_name')}</td>
          <td colSpan={3} />
        </tr>
      </tbody>
    </table>
  );
}
