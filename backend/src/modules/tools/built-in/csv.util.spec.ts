/**
 * Pure CSV helpers — unit tests (G9).
 *
 * Covers the round-trip invariants the SheetsTool.import_csv / export_csv
 * paths rely on: RFC-4180 quoting, custom delimiters, CRLF / empty line
 * handling, and the column-letter converter.
 */

import {
  colToLetter,
  parseCsv,
  toCsv,
  csvEscape,
} from './csv.util';

describe('colToLetter', () => {
  it('handles single-letter columns', () => {
    expect(colToLetter(1)).toBe('A');
    expect(colToLetter(2)).toBe('B');
    expect(colToLetter(26)).toBe('Z');
  });

  it('handles double-letter columns past Z', () => {
    expect(colToLetter(27)).toBe('AA');
    expect(colToLetter(28)).toBe('AB');
    expect(colToLetter(52)).toBe('AZ');
    expect(colToLetter(53)).toBe('BA');
  });

  it('handles triple-letter columns', () => {
    expect(colToLetter(702)).toBe('ZZ');
    expect(colToLetter(703)).toBe('AAA');
  });
});

describe('parseCsv', () => {
  it('parses simple comma-separated rows', () => {
    expect(parseCsv('a,b,c\n1,2,3\n', ',')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('honours a custom delimiter', () => {
    expect(parseCsv('a;b;c\n1;2;3\n', ';')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });

  it('supports tab and pipe delimiters', () => {
    expect(parseCsv('a\tb\tc\n', '\t')).toEqual([['a', 'b', 'c']]);
    expect(parseCsv('a|b|c\n', '|')).toEqual([['a', 'b', 'c']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d\r\n', ',')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('collapses a trailing empty line', () => {
    expect(parseCsv('a,b\n\n', ',')).toEqual([['a', 'b']]);
  });

  it('parses quoted fields with embedded delimiters', () => {
    expect(parseCsv('a,"b,c",d\n', ',')).toEqual([
      ['a', 'b,c', 'd'],
    ]);
  });

  it('handles doubled quotes inside quoted fields (RFC 4180 escape)', () => {
    expect(parseCsv('a,"he said ""hi""",b\n', ',')).toEqual([
      ['a', 'he said "hi"', 'b'],
    ]);
  });

  it('preserves newlines inside quoted fields', () => {
    expect(parseCsv('"line1\nline2",b\n', ',')).toEqual([
      ['line1\nline2', 'b'],
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(parseCsv('', ',')).toEqual([]);
  });

  it('returns one row for input without newlines', () => {
    expect(parseCsv('x', ',')).toEqual([['x']]);
  });
});

describe('toCsv', () => {
  it('serialises a 2-D array', () => {
    expect(toCsv([['a', 'b'], ['1', '2']], ',')).toBe('a,b\n1,2');
  });

  it('escapes fields containing the delimiter', () => {
    expect(toCsv([['a', 'b,c']], ',')).toBe('a,"b,c"');
  });

  it('escapes fields containing double quotes', () => {
    expect(toCsv([['a', 'b"c']], ',')).toBe('a,"b""c"');
  });

  it('escapes fields containing newlines', () => {
    expect(toCsv([['a', 'b\nc']], ',')).toBe('a,"b\nc"');
  });

  it('round-trips through parseCsv', () => {
    const rows = [
      ['name', 'role'],
      ['Ada', 'CTO, Founder'],
      ['Linus', '"curmudgeon"'],
      ['multi\nline', 'tab\there'],
    ];
    const csv = toCsv(rows, ',');
    const parsed = parseCsv(csv, ',');
    expect(parsed).toEqual(rows);
  });
});

describe('csvEscape', () => {
  it('passes plain fields through unchanged', () => {
    expect(csvEscape('hello', ',')).toBe('hello');
  });

  it('quotes fields containing the active delimiter', () => {
    expect(csvEscape('a,b', ',')).toBe('"a,b"');
    expect(csvEscape('a;b', ';')).toBe('"a;b"');
  });

  it('quotes and doubles internal double-quotes', () => {
    expect(csvEscape('a"b', ',')).toBe('"a""b"');
  });

  it('quotes fields containing newlines', () => {
    expect(csvEscape('a\nb', ',')).toBe('"a\nb"');
  });
});
