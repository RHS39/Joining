/**
 * Mapping of a PDF form to the fields of the application.
 *
 * The engine is deliberately forgiving: it looks for the label of a field in
 * the text of the document and takes the value that follows it. Every value
 * is shown to the user before it is written into the form, so a wrong guess
 * never reaches the database.
 *
 * Three layouts are understood:
 *  1. `First Name: Rahul`          — the value follows a colon,
 *  2. `First Name        Rahul`    — the value stands next to the label,
 *  3. `First Name` / `Rahul`       — the value stands below the label.
 */
import type { FieldDefinition } from '@/types';
import { getAllColumns, type ColumnType } from './columns';
import { STANDARD_FORMAT, type PdfFormat } from './pdfFormat';
import type { PdfPage, PdfWord } from './pdf';

/** A field of the application that can be filled from a PDF. */
export interface PdfTarget {
  /** Column key of the field (`date`, `title`, `custom:first_name`, …). */
  key: string;
  /** Label of the field. */
  label: string;
  /** Type of the field, used to clean the extracted value. */
  type: ColumnType;
  /** Normalised alternative names of the label. */
  aliases: string[];
  /** Allowed values for select fields. */
  options?: string[];
}

/** A value found in the PDF. */
export interface PdfMatch {
  /** Column key of the field the value belongs to. */
  key: string;
  /** Label of the field. */
  label: string;
  /** Cleaned value, ready to be written into the form. */
  value: string;
  /** The text that was found in the PDF. */
  rawValue: string;
  /** The label as it was written on the form. */
  matchedText: string;
  /** Page the value was found on. */
  pageNumber: number;
  /** 1 = next to the label, 0.7 = below the label. */
  confidence: number;
  /** Set when the value could not be read reliably. */
  warning?: string;
  /** Set when the value is usable but worth a second look. */
  hint?: string;
}

/**
 * Alternative names of the built-in fields. They are more specific than the
 * spreadsheet aliases: a bare "name" would match too many labels.
 */
export const PDF_BUILTIN_ALIASES: Record<string, string[]> = {
  recordId: ['employee id', 'emp id', 'employee code', 'emp code', 'id no', 'id number', 'employee id no'],
  date: ['date of joining', 'date of join', 'joining date', 'doj'],
  title: [
    'employee name',
    'name of employee',
    'name of the employee',
    'name of ip',
    'name of i p',
    'full name',
  ],
  category: ['category', 'employment category', 'type of employment'],
  description: ['remarks', 'remark', 'notes', 'comment', 'comments'],
};

/**
 * The sections of the form that carry their own labels. The section a label
 * stands in decides which field the value belongs to.
 */
export const PDF_SECTIONS = STANDARD_FORMAT.sections.reduce<Record<string, string[]>>((result, section) => {
  result[section.id] = [...section.headings];
  return result;
}, {});

/** The blocks of the form that print a table — their lines are not read. */
const PDF_TABLE_SECTIONS = new Set(
  STANDARD_FORMAT.sections.filter((section) => section.table).map((section) => section.id),
);

/** Built-in columns that are not part of a personnel form. */
const EXCLUDED_KEYS = new Set(['quantity', 'unitPrice', 'totalAmount']);

/** Lower case, without punctuation, with single spaces. */
export function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove the separators a form may print around a value. */
function cleanValue(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/^[\s:|_]+/, '').replace(/[\s:|_]+$/, '').trim();
}

/** Build the list of fields that can be filled from a PDF. */
export function buildPdfTargets(customFields: FieldDefinition[]): PdfTarget[] {
  const targets: PdfTarget[] = [];

  getAllColumns(customFields).forEach((column) => {
    if (EXCLUDED_KEYS.has(column.key)) return;
    const aliases = column.key.startsWith('custom:')
      ? column.aliases
      : (PDF_BUILTIN_ALIASES[column.key] ?? column.aliases);
    const normalised = aliases.map(normaliseText).filter((alias) => alias.length > 0);
    targets.push({
      key: column.key,
      label: column.label,
      type: column.type,
      aliases: Array.from(new Set(normalised)),
      options: column.options,
    });
  });

  return targets;
}

/* ------------------------------------------------------------------ lines */

interface PdfLine {
  pageNumber: number;
  y: number;
  words: PdfWord[];
}

/**
 * Split a word at a colon: "First Name: Rahul" becomes the label "First
 * Name" and the value "Rahul", both with their own position.
 */
function splitAtColons(words: PdfWord[]): PdfWord[] {
  const result: PdfWord[] = [];

  words.forEach((word) => {
    const parts = word.text.split(':');
    if (parts.length === 1) {
      result.push(word);
      return;
    }

    let offset = 0;
    parts.forEach((part) => {
      const share = word.text.length > 0 ? (part.length / word.text.length) * word.width : word.width;
      if (part.trim()) {
        result.push({
          text: part,
          x: word.x + offset,
          y: word.y,
          width: share,
          height: word.height,
        });
      }
      offset += share;
    });
  });

  return result;
}

/** Group the words of the pages into lines (top to bottom, left to right). */
function buildLines(pages: PdfPage[]): PdfLine[] {
  const lines: PdfLine[] = [];

  pages.forEach((page) => {
    const words = [...page.words].sort((a, b) => b.y - a.y || a.x - b.x);
    let current: PdfLine | null = null;

    words.forEach((word) => {
      const tolerance = Math.max(3, (word.height || 10) * 0.6);
      if (!current || Math.abs(current.y - word.y) > tolerance) {
        current = { pageNumber: page.pageNumber, y: word.y, words: [word] };
        lines.push(current);
        return;
      }
      current.words.push(word);
    });
  });

  return lines.map((line) => ({
    ...line,
    words: splitAtColons(line.words.sort((a, b) => a.x - b.x)),
  }));
}

/* --------------------------------------------------------------- sections */

/** The text of a line. */
function lineText(line: PdfLine): string {
  return normaliseText(line.words.map((word) => word.text).join(' '));
}

/** The section a heading stands for, `''` for an unknown heading. */
function sectionOfHeading(text: string): string {
  const known = (Object.keys(PDF_SECTIONS) as (keyof typeof PDF_SECTIONS)[]).find((section) =>
    PDF_SECTIONS[section].some((alias) => text === alias || text.startsWith(`${alias} `)),
  );
  return known ?? '';
}

/**
 * Find the section every line belongs to.
 *
 * A heading is a line that is printed in a bigger font than the body of the
 * form, or a line that carries the name of a known section. A line inherits
 * the section of the heading above it; an unknown heading ends the section.
 */
function detectSections(lines: PdfLine[]): { sections: string[]; headings: boolean[] } {
  const heights = lines
    .map((line) => Math.max(...line.words.map((word) => word.height || 0), 0))
    .filter((height) => height > 0)
    .sort((a, b) => a - b);
  const bodyHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 0;

  const sections: string[] = [];
  const headings: boolean[] = [];
  let current = '';

  lines.forEach((line) => {
    const text = lineText(line);
    const known = sectionOfHeading(text);
    const height = Math.max(...line.words.map((word) => word.height || 0), 0);
    const isHeading = known !== '' || (bodyHeight > 0 && height > bodyHeight * 1.15);

    if (isHeading) current = known;
    sections.push(current);
    headings.push(isHeading);
  });

  return { sections, headings };
}

/* ----------------------------------------------------------------- aliases */

interface AliasEntry {
  target: PdfTarget;
  alias: string;
  /** Section the label belongs to, `''` when it fits everywhere. */
  section: string;
}

/**
 * Index of every alias, so a label can be found in a single lookup. An alias
 * can have several entries: one for the whole form and one per block of the
 * form it belongs to.
 */
function buildAliasIndex(targets: PdfTarget[]): Map<string, AliasEntry[]> {
  const index = new Map<string, AliasEntry[]>();
  const byKey = new Map(targets.map((target) => [target.key, target]));

  const push = (alias: string, entry: AliasEntry) => {
    const entries = index.get(alias) ?? [];
    entries.push(entry);
    index.set(alias, entries);
  };

  targets.forEach((target) => {
    target.aliases.forEach((alias) => {
      push(alias, { target, alias, section: '' });
    });
  });

  // The rules of the standard format add an entry for every label they name.
  STANDARD_FORMAT.rules.forEach((rule) => {
    const target = byKey.get(rule.target);
    // A rule that points at a field the form does not have is ignored.
    if (!target) return;
    rule.aliases.forEach((alias) => {
      const normalised = normaliseText(alias);
      // A label that the form knows already keeps its own field.
      if (!index.has(normalised)) {
        push(normalised, { target, alias: normalised, section: '' });
      }
      push(normalised, { target, alias: normalised, section: rule.section });
    });
  });

  return index;
}

/**
 * The entry that applies in the given block: the rule of the block wins, a
 * form without any heading uses the rule that fits everywhere. A label that
 * belongs to another block is not read at all.
 */
function pickEntry(entries: AliasEntry[], section: string): AliasEntry | null {
  if (!section) {
    return entries.find((entry) => entry.section === '') ?? null;
  }
  const scoped = entries.filter((entry) => entry.section !== '');
  const match = scoped.find((entry) => entry.section === section);
  if (match) return match;
  // The label belongs to another block of the form.
  if (scoped.length > 0) return null;
  return entries.find((entry) => entry.section === '') ?? null;
}

/** Longest alias that starts at the given word, if any. */
function matchAliasAt(
  words: PdfWord[],
  index: number,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
): { entry: AliasEntry; end: number } | null {
  for (let count = 4; count >= 1; count -= 1) {
    if (index + count > words.length) continue;
    const parts: string[] = [];
    for (let step = 0; step < count; step += 1) {
      const normalised = normaliseText(words[index + step].text);
      if (normalised) parts.push(normalised);
    }
    const joined = parts.join(' ').trim();
    if (!joined) continue;
    const entries = aliasIndex.get(joined);
    if (!entries) continue;
    const entry = pickEntry(entries, section);
    if (entry) return { entry, end: index + count - 1 };
  }
  return null;
}

/* ------------------------------------------------------------------ values */

/** Collect the value that stands next to a label. */
function collectValue(
  words: PdfWord[],
  startIndex: number,
  target: PdfTarget,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
): { text: string; end: number } | null {
  if (startIndex >= words.length) return null;

  const parts: string[] = [];
  let index = startIndex;

  while (index < words.length && parts.length < 4) {
    const hit = matchAliasAt(words, index, aliasIndex, section);
    // Another label starts here: the value of the current field is empty.
    if (hit && hit.entry.target.key !== target.key) break;

    if (parts.length > 0) {
      const previous = words[index - 1];
      const gap = words[index].x - (previous.x + previous.width);
      // A large gap means that a new field starts far away on the same line.
      if (gap > 120) break;
    }

    parts.push(words[index].text.trim());
    index += 1;
  }

  const text = cleanValue(parts.join(' '));
  return text ? { text, end: index - 1 } : null;
}

/** Collect the value that stands below a label (label above an empty box). */
function collectValueBelow(
  lines: PdfLine[],
  lineIndex: number,
  labelWord: PdfWord,
  target: PdfTarget,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
): string | null {
  const line = lines[lineIndex];

  for (let offset = 1; offset <= 2; offset += 1) {
    const candidate = lines[lineIndex + offset];
    if (!candidate || candidate.pageNumber !== line.pageNumber) break;
    if (line.y - candidate.y > 40) break;

    const wordIndex = candidate.words.findIndex((word) => word.x >= labelWord.x - 12);
    if (wordIndex < 0) continue;

    const word = candidate.words[wordIndex];
    const gap = word.x - (labelWord.x + labelWord.width);
    if (gap > 140) continue;

    const hit = matchAliasAt(candidate.words, wordIndex, aliasIndex, section);
    if (hit && hit.entry.target.key !== target.key) continue;

    const parts = [word.text.trim()];
    for (let step = wordIndex + 1; step < candidate.words.length && parts.length < 3; step += 1) {
      const next = candidate.words[step];
      const nextHit = matchAliasAt(candidate.words, step, aliasIndex, section);
      if (nextHit && nextHit.entry.target.key !== target.key) break;
      if (next.x - (candidate.words[step - 1].x + candidate.words[step - 1].width) > 40) break;
      parts.push(next.text.trim());
    }

    const text = cleanValue(parts.join(' '));
    if (text) return text;
  }

  return null;
}

/* ------------------------------------------------------------- conversion */

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(value: number): string {
  return `${value}`.padStart(2, '0');
}

/**
 * Read a date written on a form. The day first convention is used, it is the
 * one of the Indian joining forms; a value that cannot be day first is read
 * as month first.
 */
export function parseFormDate(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const numeric = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    let year = Number(numeric[3]);
    if (year < 100) year += 2000;

    let day = first;
    let month = second;
    if (first <= 12 && second > 12) {
      day = second;
      month = first;
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const iso = `${year}-${pad(month)}-${pad(day)}`;
    return isCalendarDate(iso) ? iso : null;
  }

  // "1st June 2024", "01 June 2024", "1-June-2024"
  const named = text.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-.]+([a-z]{3,})[\s\-.,]+(\d{2,4})$/i);
  if (named) {
    const day = Number(named[1]);
    const monthIndex = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    let year = Number(named[3]);
    if (year < 100) year += 2000;
    if (monthIndex < 0) return null;
    const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    return isCalendarDate(iso) ? iso : null;
  }

  // "June 1, 2024", "June 1 2024"
  const monthFirst = text.match(/^([a-z]{3,})[\s\-.]+(\d{1,2})(?:st|nd|rd|th)?[\s\-.,]+(\d{2,4})$/i);
  if (monthFirst) {
    const monthIndex = MONTHS.indexOf(monthFirst[1].slice(0, 3).toLowerCase());
    const day = Number(monthFirst[2]);
    let year = Number(monthFirst[3]);
    if (year < 100) year += 2000;
    if (monthIndex < 0) return null;
    const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    return isCalendarDate(iso) ? iso : null;
  }

  const yearFirst = text.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (yearFirst) {
    const iso = `${yearFirst[1]}-${pad(Number(yearFirst[2]))}-${pad(Number(yearFirst[3]))}`;
    return isCalendarDate(iso) ? iso : null;
  }

  return null;
}

/** True when the string is a real calendar date in `YYYY-MM-DD` form. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** Read a number written on a form. */
export function parseFormNumber(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '').replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Read a value of a drop-down field. */
export function matchOption(raw: string, options: string[] | undefined): string | null {
  if (!options || options.length === 0) return null;
  const normalised = normaliseText(raw);
  if (!normalised) return null;
  const exact = options.find((option) => normaliseText(option) === normalised);
  if (exact) return exact;
  const partial = options.find((option) => {
    const candidate = normaliseText(option);
    return candidate.length > 1 && normalised.includes(candidate);
  });
  return partial ?? null;
}

/** True when the text ends with a six digit PIN code. */
export function endsWithPinCode(text: string): boolean {
  return /\d{6}\s*$/.test(text.trim());
}

/**
 * Join two lines of a value: a word that is split over two lines is joined
 * back together, every other line is separated by a space.
 */
function joinLines(previous: string, next: string): string {
  if (!previous) return next;
  const split = /[a-z]$/.test(previous) && /^[a-z]/.test(next);
  return split ? `${previous}${next}` : `${previous} ${next}`;
}

/** The x of every label of the line, in the order of the line. */
function labelPositions(
  line: PdfLine,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
): number[] {
  const positions: number[] = [];
  let index = 0;

  while (index < line.words.length) {
    const hit = matchAliasAt(line.words, index, aliasIndex, section);
    if (!hit) {
      index += 1;
      continue;
    }
    positions.push(line.words[index].x);
    index = hit.end + 1;
  }

  return positions;
}

/**
 * The words of the next line that continue the label of this line. A form
 * prints long labels over two lines — "Date of" and "Appointment" for
 * example. Only the words of the same column belong to the label.
 */
function continuationWords(
  line: PdfLine,
  nextLine: PdfLine | undefined,
  labelIndex: number,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
): PdfWord[] {
  if (!nextLine) return [];
  const start = line.words[labelIndex];
  if (!start) return [];
  const nextLabel = labelPositions(line, aliasIndex, section).find((x) => x > start.x);
  const columnEnd = nextLabel ?? Number.POSITIVE_INFINITY;
  return nextLine.words.filter((word) => word.x >= start.x - 12 && word.x < columnEnd);
}

/**
 * Find a label that is printed over two lines: the first part stands on the
 * line, the rest of it on the line below.
 */
function matchAliasAcrossLines(
  line: PdfLine,
  nextLine: PdfLine | undefined,
  index: number,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
): { entry: AliasEntry; lineEnd: number } | null {
  const continuation = continuationWords(line, nextLine, index, aliasIndex, section);
  if (continuation.length === 0) return null;

  // The part of the label that stands on the line.
  for (let lineEnd = index; lineEnd < Math.min(index + 3, line.words.length); lineEnd += 1) {
    const head = normaliseText(line.words.slice(index, lineEnd + 1).map((word) => word.text).join(' '));
    if (!head) continue;

    for (let taken = 1; taken <= Math.min(2, continuation.length); taken += 1) {
      const tail = normaliseText(
        continuation
          .slice(0, taken)
          .map((word) => word.text)
          .join(' '),
      );
      if (!tail) continue;

      const entries = aliasIndex.get(`${head} ${tail}`);
      if (!entries) continue;
      const entry = pickEntry(entries, section);
      if (entry) return { entry, lineEnd };
    }
  }

  return null;
}

/**
 * Collect a value that is printed over several lines — an address for
 * example. The value ends with the line that carries the PIN code; a line
 * that starts a new field or a new block ends it as well. Only the words of
 * the column the value stands in are read, so two addresses that stand next
 * to each other do not mix.
 */
function collectMultilineValue(
  lines: PdfLine[],
  lineIndex: number,
  start: number,
  end: number,
  target: PdfTarget,
  aliasIndex: Map<string, AliasEntry[]>,
  section: string,
  headings: boolean[],
): string | null {
  const line = lines[lineIndex];
  const parts: string[] = [];

  const first = collectValue(line.words, end + 1, target, aliasIndex, section);
  if (first) parts.push(first.text);

  // The column the label stands in: it starts at the label and ends before
  // the label of the next column.
  const labelWord = line.words[start] ?? line.words[0];
  const columnStart = labelWord.x - 12;
  const nextLabel = labelPositions(line, aliasIndex, section).find((x) => x > labelWord.x);
  const columnEnd = nextLabel ?? Number.POSITIVE_INFINITY;

  for (let offset = 1; offset <= 4; offset += 1) {
    // The value is complete when the PIN code was read.
    if (parts.length > 0 && endsWithPinCode(parts[parts.length - 1])) break;

    const candidate = lines[lineIndex + offset];
    if (!candidate || candidate.pageNumber !== line.pageNumber) break;
    // A new block starts here.
    if (headings[lineIndex + offset]) break;

    // Only the words of the column of the value.
    const column = candidate.words.filter((word) => word.x >= columnStart - 12 && word.x < columnEnd);
    if (column.length === 0) break;
    // A new field starts here.
    if (matchAliasAt(column, 0, aliasIndex, section)) break;

    const text = cleanValue(column.map((word) => word.text).join(' '));
    if (!text) break;
    parts.push(text);
  }

  if (parts.length === 0) return null;
  return parts.reduce((previous, part) => joinLines(previous, part)).trim();
}

/**
 * The standard format the document follows. A document is recognised when it
 * carries the blocks of the standard format.
 */
export function detectStandardFormat(pages: PdfPage[]): PdfFormat | null {
  const text = normaliseText(
    pages.map((page) => page.words.map((word) => word.text).join(' ')).join(' '),
  );
  const found = STANDARD_FORMAT.sections.filter((section) =>
    section.headings.some((heading) => text.includes(heading)),
  ).length;
  return found >= 2 ? STANDARD_FORMAT : null;
}

/* ---------------------------------------------------------------- mapping */

/** The fields that carry the parts of the name. */
const NAME_PART_KEYS = ['custom:first_name', 'custom:middle_name', 'custom:last_name'] as const;

/**
 * Split a full name into its parts, based on the number of words:
 * one word is the first name, two words are the first and the last name,
 * three words are the first, the middle and the last name and every further
 * word belongs to the last name.
 */
export function splitFullName(fullName: string): { first: string; middle: string; last: string } {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { first: '', middle: '', last: '' };
  if (words.length === 1) return { first: words[0], middle: '', last: '' };
  if (words.length === 2) return { first: words[0], middle: '', last: words[1] };
  return { first: words[0], middle: words[1], last: words.slice(2).join(' ') };
}

/**
 * Fill the parts of the name that the form does not print itself with the
 * parts of the full name.
 */
function deriveNameParts(matches: Map<string, PdfMatch>, targets: PdfTarget[]): void {
  const fullName = matches.get('title');
  if (!fullName) return;

  const parts = splitFullName(fullName.value);
  const values: Record<string, string> = {
    'custom:first_name': parts.first,
    'custom:middle_name': parts.middle,
    'custom:last_name': parts.last,
  };

  NAME_PART_KEYS.forEach((key) => {
    const value = values[key];
    // A value that was read from the form always wins.
    if (!value || matches.has(key)) return;
    const target = targets.find((item) => item.key === key);
    if (!target) return;
    matches.set(key, {
      key,
      label: target.label,
      value,
      rawValue: value,
      matchedText: fullName.matchedText,
      pageNumber: fullName.pageNumber,
      confidence: 0.6,
    });
  });
}

/**
 * Read the values of the form and match them with the fields of the
 * application. One field is filled at most once — the value with the highest
 * confidence wins.
 */
export function mapPdfToFields(pages: PdfPage[], targets: PdfTarget[]): PdfMatch[] {
  const lines = buildLines(pages);
  const { sections, headings } = detectSections(lines);
  const aliasIndex = buildAliasIndex(targets);
  const best = new Map<string, PdfMatch>();

  lines.forEach((line, lineIndex) => {
    const section = sections[lineIndex] ?? '';
    // The blocks that print a table hold no fields of the form.
    if (PDF_TABLE_SECTIONS.has(section)) return;

    let index = 0;

    while (index < line.words.length) {
      const hit = matchAliasAt(line.words, index, aliasIndex, section);
      if (!hit) {
        // The label may be printed over two lines.
        const across = matchAliasAcrossLines(line, lines[lineIndex + 1], index, aliasIndex, section);
        if (!across) {
          index += 1;
          continue;
        }
        const { entry, lineEnd } = across;
        const target = entry.target;
        const labelWord = line.words[lineEnd];

        const value = collectValue(line.words, lineEnd + 1, target, aliasIndex, section);
        index = lineEnd + 1;
        if (!value) continue;

        const match = buildMatch(target, value.text, line.pageNumber, 1, labelWord.text);
        const previous = best.get(target.key);
        if (!previous || match.confidence > previous.confidence) {
          best.set(target.key, match);
        }
        continue;
      }

      const { entry, end } = hit;
      const target = entry.target;
      const labelWord = line.words[end];

      let value: string | null = null;
      let confidence = 1;

      if (target.type === 'multiline') {
        // An address is printed over several lines and ends with the PIN code.
        value = collectMultilineValue(lines, lineIndex, index, end, target, aliasIndex, section, headings);
        if (!value) {
          value = collectValueBelow(lines, lineIndex, labelWord, target, aliasIndex, section);
          confidence = 0.7;
        }
      } else {
        const next = collectValue(line.words, end + 1, target, aliasIndex, section);
        if (next) {
          value = next.text;
        } else {
          value = collectValueBelow(lines, lineIndex, labelWord, target, aliasIndex, section);
          confidence = 0.7;
        }
      }

      index = end + 1;

      if (!value) continue;

      const match = buildMatch(target, value, line.pageNumber, confidence, labelWord.text);
      const previous = best.get(target.key);
      if (!previous || match.confidence > previous.confidence) {
        best.set(target.key, match);
      }
    }
  });

  // The parts of the name are taken from the full name when the form does
  // not print them on its own.
  deriveNameParts(best, targets);

  return Array.from(best.values()).sort((a, b) => b.confidence - a.confidence);
}

/** Turn a raw value into the value of the field. */
export function buildMatch(
  target: PdfTarget,
  rawValue: string,
  pageNumber: number,
  confidence: number,
  matchedText: string,
): PdfMatch {
  const match: PdfMatch = {
    key: target.key,
    label: target.label,
    value: rawValue,
    rawValue,
    matchedText: matchedText.trim(),
    pageNumber,
    confidence,
  };

  if (target.type === 'date') {
    const iso = parseFormDate(rawValue);
    if (iso) {
      match.value = iso;
    } else {
      match.warning = 'The date could not be read — correct it before applying it.';
    }
    return match;
  }

  if (target.type === 'number') {
    const numeric = parseFormNumber(rawValue);
    if (numeric === null) {
      match.warning = 'The number could not be read — correct it before applying it.';
    } else {
      match.value = String(numeric);
    }
    return match;
  }

  if (target.type === 'category' && target.options?.length) {
    const option = matchOption(synonymOf(target, rawValue), target.options);
    if (option) {
      match.value = option;
    } else {
      match.warning = `"${rawValue}" is not one of the allowed values.`;
    }
    return match;
  }

  if (target.type === 'multiline' && /address/i.test(target.label) && !endsWithPinCode(rawValue)) {
    // The address is read until the PIN code — without it a line is missing.
    match.hint = 'The address does not end with a PIN code — a line may be missing.';
  }

  // The value has to match the pattern of the field, the card for example
  // only prints whether the Aadhaar is verified.
  const pattern = STANDARD_FORMAT.patterns?.[target.key];
  if (pattern && !pattern.test(rawValue.trim())) {
    match.warning = `"${rawValue}" is not a value of the ${target.label} field.`;
  }

  return match;
}

/** The value in the wording the field allows it. */
function synonymOf(target: PdfTarget, rawValue: string): string {
  const synonyms = STANDARD_FORMAT.synonyms?.[target.key];
  if (!synonyms) return rawValue;
  const synonym = synonyms[normaliseText(rawValue)];
  return synonym ?? rawValue;
}
