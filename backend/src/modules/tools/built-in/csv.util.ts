/**
 * Pure CSV helpers used by SheetsTool.import_csv / export_csv.
 *
 * Extracted so they can be unit-tested without spinning up the Nest harness
 * or a real GoogleSheetsService.
 */

export type CsvDelimiter = ',' | ';' | '\t' | '|';

/**
 * Convert a 1-based column index to spreadsheet letter notation.
 *   1 → 'A', 26 → 'Z', 27 → 'AA', 52 → 'AZ', 53 → 'BA', ...
 */
export function colToLetter(colIndex1Based: number): string {
  let n = colIndex1Based;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out || 'A';
}

/**
 * Parse CSV text into a 2-D array of cell values.
 * Supports RFC-4180 quoted fields (doubled `"` inside quotes is a literal `"`).
 * Empty trailing line collapses. CRLF handled (`\r` is dropped once `\n` follows).
 */
export function parseCsv(input: string, delimiter: CsvDelimiter): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      field = '';
      if (!(row.length === 1 && row[0] === '')) rows.push(row);
      row = [];
    } else if (c === '\r') {
      // ignore (handled by the following \n)
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
  }
  return rows;
}

export function csvEscape(field: string, delimiter: string): string {
  if (
    field.includes(delimiter) ||
    field.includes('"') ||
    field.includes('\n')
  ) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export function toCsv(rows: string[][], delimiter: CsvDelimiter): string {
  return rows
    .map((row) => row.map((f) => csvEscape(f ?? '', delimiter)).join(delimiter))
    .join('\n');
}
