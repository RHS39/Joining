/**
 * Excel / CSV import and export built on SheetJS.
 *
 * Everything happens in the browser: files are read with the File API and parsed
 * with SheetJS, no upload to any server takes place.
 */
import type { DataRecord, FieldDefinition } from '@/types';
import { EXPORT_COLUMNS, getAllColumns, getColumnValue, type FieldColumn } from './columns';
import { downloadBlob, downloadText } from './download';
import { safeFileName } from './format';

type XlsxModule = typeof import('xlsx');

let xlsxPromise: Promise<XlsxModule> | null = null;

/**
 * SheetJS is fairly large, so it is loaded on demand: the dashboard, the forms
 * and the reports never have to download it.
 */
export function loadXlsx(): Promise<XlsxModule> {
  if (!xlsxPromise) xlsxPromise = import('xlsx');
  return xlsxPromise;
}

/* ------------------------------------------------------------------ export */

export interface ExportOptions {
  /** Target file name (without extension). */
  fileName: string;
  /** Worksheet name. */
  sheetName?: string;
  /** User defined fields to append as extra columns. */
  customFields?: FieldDefinition[];
}

const DATE_COLUMN_KEYS = new Set(['date', 'createdAt', 'updatedAt']);

/** Convert `YYYY-MM-DD` into a local Date anchored at noon (avoids timezone drift). */
export function toLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Build the tabular representation of the given records. */
export function buildSheetMatrix(records: DataRecord[], columns: FieldColumn[]): (string | number | boolean | Date | null)[][] {
  return records.map((record) =>
    columns.map((column) => {
      const value = getColumnValue(record, column.key);
      if (value === null || value === undefined) return null;
      if (column.type === 'date' && typeof value === 'string') {
        return toLocalDate(value) ?? value;
      }
      if (column.type === 'number' || column.type === 'currency') {
        return typeof value === 'number' ? value : Number(value);
      }
      return value;
    }),
  );
}

/** Compute readable column widths. */
function computeWidths(matrix: (string | number | boolean | Date | null)[][], columns: FieldColumn[]): { wch: number }[] {
  return columns.map((column, index) => {
    let max = column.label.length;
    for (const row of matrix) {
      const cell = row[index];
      const length = cell instanceof Date ? 10 : String(cell ?? '').length;
      if (length > max) max = length;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 42) };
  });
}

/** Export records to an `.xlsx` workbook. */
export async function exportRecordsToExcel(records: DataRecord[], options: ExportOptions): Promise<void> {
  const XLSX = await loadXlsx();
  const columns = [...EXPORT_COLUMNS, ...getAllColumns(options.customFields ?? []).filter((c) => c.key.startsWith('custom:'))];
  const matrix = buildSheetMatrix(records, columns);
  const sheet = XLSX.utils.aoa_to_sheet(
    [columns.map((column) => column.label), ...matrix],
    { cellDates: true, dateNF: 'yyyy-mm-dd' },
  );

  sheet['!cols'] = computeWidths(matrix, columns);
  if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] };

  // Numeric columns keep a currency / number format.
  const headerOffset = 1;
  matrix.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      const column = columns[columnIndex];
      if (!column || value === null) return;
      const address = XLSX.utils.encode_cell({ r: rowIndex + headerOffset, c: columnIndex });
      const cell = sheet[address];
      if (!cell) return;
      if (column.type === 'currency' && cell.t === 'n') cell.z = '#,##0.00';
      if (column.type === 'number' && cell.t === 'n') cell.z = '#,##0.####';
      if (DATE_COLUMN_KEYS.has(column.key) && cell.t === 'd') cell.z = 'yyyy-mm-dd';
    });
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, options.sheetName ?? 'Employees');
  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${safeFileName(options.fileName)}.xlsx`,
  );
}

/** Export records to a CSV file (UTF-8 with BOM so Excel reads it correctly). */
export async function exportRecordsToCsv(records: DataRecord[], options: ExportOptions): Promise<void> {
  const XLSX = await loadXlsx();
  const columns = [...EXPORT_COLUMNS, ...getAllColumns(options.customFields ?? []).filter((c) => c.key.startsWith('custom:'))];
  const matrix = buildSheetMatrix(records, columns);
  const sheet = XLSX.utils.aoa_to_sheet(
    [columns.map((column) => column.label), ...matrix],
    { cellDates: true, dateNF: 'yyyy-mm-dd' },
  );
  const csv = XLSX.utils.sheet_to_csv(sheet);
  downloadText(`\uFEFF${csv}`, `${safeFileName(options.fileName)}.csv`, 'text/csv;charset=utf-8');
}

/* ------------------------------------------------------------------ import */

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** Data rows, excluding the header row. */
  rows: unknown[][];
  /** 1-based row numbers in the original sheet (for error reports). */
  rowNumbers: number[];
}

export interface ParsedWorkbook {
  fileName: string;
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
}

/** Parse an uploaded `.xlsx` / `.xls` / `.csv` file into raw rows. */
export async function readSpreadsheet(file: File): Promise<ParsedWorkbook> {
  const XLSX = await loadXlsx();
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!['xlsx', 'xls', 'csv', 'ods'].includes(extension)) {
    throw new Error(`Unsupported file type ".${extension}". Please upload an .xlsx, .xls or .csv file.`);
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('The file is larger than 25 MB. Please split it into smaller files.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true, cellNF: false, cellText: false });

  const sheets: Record<string, ParsedSheet> = {};
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
    });
    const headerRow = (aoa[0] ?? []).map((value) => (value === null || value === undefined ? '' : String(value).trim()));
    const rows: unknown[][] = [];
    const rowNumbers: number[] = [];
    aoa.slice(1).forEach((row, index) => {
      const values = Array.isArray(row) ? row : [row];
      if (values.every((value) => value === null || value === undefined || String(value).trim() === '')) return;
      rows.push(values);
      rowNumbers.push(index + 2);
    });
    sheets[name] = { name, headers: headerRow, rows, rowNumbers };
  }

  if (workbook.SheetNames.length === 0) {
    throw new Error('The file does not contain any worksheet.');
  }

  return { fileName: file.name, sheetNames: [...workbook.SheetNames], sheets };
}

/** Build a downloadable error report for rejected rows. */
export function downloadErrorReport(
  fileName: string,
  rejected: { rowNumber: number; reason: string; raw: Record<string, unknown> }[],
  headers: string[],
): void {
  const lines: string[] = [];
  lines.push('Row,Reason,' + headers.map((header) => `"${header.replace(/"/g, '""')}"`).join(','));
  rejected.forEach((row) => {
    const raw = headers.map((header) => `"${String(row.raw[header] ?? '').replace(/"/g, '""')}"`).join(',');
    lines.push(`${row.rowNumber},"${row.reason.replace(/"/g, '""')}",${raw}`);
  });
  downloadText(`\uFEFF${lines.join('\n')}`, `${safeFileName(fileName)}-error-report.csv`, 'text/csv;charset=utf-8');
}
