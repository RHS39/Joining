/**
 * Reading the bank details from the photo of a passbook.
 *
 * The OCR engine hands over the text of the photo, this module picks the bank
 * details out of it: the account number, the IFSC code, the bank and the
 * branch. Every passbook is printed differently, so the values are only a
 * suggestion — the user sees them and confirms them before they are written
 * into the form.
 */
import type { FieldDefinition } from '@/types';

/** A bank detail of the form that can be read from a passbook. */
export interface PassbookTarget {
  /** Key of the field in the default field list. */
  key: string;
  /** Label shown in the interface. */
  label: string;
  /** Other names of the field — used to find it in the schema of the user. */
  aliases: string[];
}

/** The bank fields of the joining form. */
export const PASSBOOK_TARGETS: PassbookTarget[] = [
  { key: 'bank_name', label: 'Bank Name', aliases: ['bank name', 'bank'] },
  {
    key: 'bank_account_no',
    label: 'Bank Account No.',
    aliases: ['bank account no', 'bank account number', 'account no', 'account number', 'a/c no', 'a/c number'],
  },
  { key: 'bank_ifsc_code', label: 'Bank IFSC Code', aliases: ['bank ifsc code', 'ifsc code', 'ifsc'] },
  { key: 'bank_branch_name', label: 'Bank Branch Name', aliases: ['bank branch name', 'branch name', 'branch'] },
];

/** A value that was read from the photo of a passbook. */
export interface PassbookMatch {
  /** Key of the field the value belongs to. */
  key: string;
  /** Label of the field. */
  label: string;
  /** The value that was read. */
  value: string;
  /** The text of the passbook the value was read from. */
  matchedText: string;
  /** Set when the value has to be checked by the user. */
  warning?: string;
}

/** What was read from the photo of a passbook. */
export interface PassbookRead {
  /** The values that were found, one per field. */
  matches: PassbookMatch[];
  /** The name of the account holder — the form has no field for it. */
  holderName: string | null;
}

/** The labels of the passbook that carry a bank detail. */
const ACCOUNT_NUMBER_LABEL = /(?:a\/c|acct|acc|account)\s*(?:no\.?|number|#)/i;
const IFSC_LABEL = /ifsc/i;
const BRANCH_LABEL = /branch\s*name|branch/i;
const BANK_NAME_LABEL = /bank\s*name/i;
const HOLDER_LABEL = /account\s*holder(?:\s*name)?|holder\s*name|customer\s*name|name\s*of\s+the\s+account/i;

/** A line that carries a label instead of a value. */
const LABEL_LINE =
  /^(a\/c|acct|acc|account|ifsc|branch|bank|name|no\.?|number|code|address|type|date|balance|holder|customer|signature|opening|closing|available|cheque)/i;

/** The value of a bank detail that was found in the text. */
interface FoundValue {
  value: string;
  matchedText: string;
}

/** Lower case, without the spaces around the words. */
function normaliseName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The lines of the text, cleaned up. */
function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** A value that still carries the name of its own label. */
function stripLabelWord(value: string): string {
  return value.replace(/^(name|no\.?|number|code|value|details)\s*[:.\-–—]?\s*/i, '').trim();
}

/**
 * The value that stands behind a label — the rest of the line or, when the
 * label stands alone, the line below it.
 */
function findValue(lines: string[], label: RegExp): FoundValue | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = label.exec(line);
    if (!match) continue;

    const rest = line.slice(match.index + match[0].length).replace(/^[\s:.\-–—]+/, '').trim();
    if (rest) return { value: rest, matchedText: line };

    // The value can stand in the line below the label.
    const next = lines[index + 1];
    if (!next || LABEL_LINE.test(next)) continue;
    return { value: next.replace(/^[\s:.\-–—]+/, '').trim(), matchedText: `${line} ${next}` };
  }

  return null;
}

/**
 * The account number of the text.
 *
 * The OCR often splits a long number into groups — the groups belong
 * together, so they are joined.
 */
export function readAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 9 && digits.length <= 18) return digits;

  const groups = (value.match(/\d+/g) ?? []).sort((a, b) => b.length - a.length);
  return groups[0] ?? '';
}

/** The IFSC code of the text — four letters, a zero and six characters. */
export function readIfsc(value: string): string {
  const match = /([A-Z]{4})\s*([0O][A-Z0-9]{6})/.exec(value.toUpperCase());
  if (!match) return '';

  // The fifth character of an IFSC code is always the digit 0. The letter O
  // is read instead of it very often, so it is put back.
  const rest = match[2].replace(/^O/, '0');
  return `${match[1]}${rest}`;
}

/** The IFSC code of the whole text — used when no label was found. */
function findIfsc(lines: string[]): string {
  for (const line of lines) {
    const match = /\b[A-Z]{4}0[A-Z0-9]{6}\b/.exec(line.toUpperCase());
    if (match) return match[0];
  }
  return '';
}

/**
 * The name of the bank. The bank prints its name in the head of the passbook
 * ("HDFC Bank Limited"), sometimes behind a label ("Bank Name: HDFC Bank").
 */
function findBankName(lines: string[]): FoundValue | null {
  const labelled = findValue(lines, BANK_NAME_LABEL);
  if (labelled?.value) return labelled;

  for (const line of lines) {
    if (!/\bbank\b/i.test(line)) continue;
    // A line that names a field is not the name of the bank.
    if (/\b(account|branch|ifsc|code|no|number|name|address)\b/i.test(line)) continue;
    return { value: line, matchedText: line };
  }

  return null;
}

/** The name of the branch — the address of the branch is not the name. */
function readBranchName(value: string): string {
  const text = stripLabelWord(value);
  const first = text.split(/[,;]/)[0].trim();
  if (!first) return '';
  return first.length > 40 ? first.slice(0, 40) : first;
}

/**
 * Read the bank details of the text of a passbook photo.
 */
export function parsePassbookText(text: string): PassbookRead {
  const lines = toLines(text);
  const matches: PassbookMatch[] = [];

  const account = findValue(lines, ACCOUNT_NUMBER_LABEL);
  if (account) {
    const accountNumber = readAccountNumber(account.value);
    if (accountNumber) {
      matches.push({
        key: 'bank_account_no',
        label: 'Bank Account No.',
        value: accountNumber,
        matchedText: account.matchedText,
        warning:
          accountNumber.length < 9 || accountNumber.length > 18
            ? `The account number has ${accountNumber.length} digits — check it.`
            : undefined,
      });
    }
  }

  const ifsc = findValue(lines, IFSC_LABEL);
  const ifscCode = (ifsc ? readIfsc(ifsc.value) : '') || findIfsc(lines);
  if (ifscCode) {
    matches.push({
      key: 'bank_ifsc_code',
      label: 'Bank IFSC Code',
      value: ifscCode,
      matchedText: ifsc?.matchedText ?? ifscCode,
    });
  }

  const bank = findBankName(lines);
  if (bank?.value) {
    matches.push({
      key: 'bank_name',
      label: 'Bank Name',
      value: bank.value,
      matchedText: bank.matchedText,
    });
  }

  const branch = findValue(lines, BRANCH_LABEL);
  if (branch) {
    const branchName = readBranchName(branch.value);
    if (branchName) {
      matches.push({
        key: 'bank_branch_name',
        label: 'Bank Branch Name',
        value: branchName,
        matchedText: branch.matchedText,
      });
    }
  }

  const holder = findValue(lines, HOLDER_LABEL);
  const holderName = holder ? stripLabelWord(holder.value) : '';

  return { matches, holderName: holderName || null };
}

/**
 * The field of the form that a bank detail is written into: the field with
 * the key of the default field list, or the field whose label names it.
 */
export function findPassbookField(fields: FieldDefinition[], target: PassbookTarget): FieldDefinition | undefined {
  const byKey = fields.find((field) => field.key === target.key);
  if (byKey) return byKey;

  const names = target.aliases.map(normaliseName);
  return fields.find((field) => {
    const candidates = [field.label, ...(field.aliases ?? [])].map(normaliseName);
    return candidates.some((candidate) => names.includes(candidate));
  });
}
