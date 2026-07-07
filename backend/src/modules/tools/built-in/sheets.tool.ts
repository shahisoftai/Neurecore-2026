import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { GoogleSheetsService } from '../../integrations/google/google-sheets.service';
import { colToLetter, parseCsv, toCsv } from './csv.util';
import type { CsvDelimiter } from './csv.util';

export const SheetsInputSchema = z.object({
  action: z
    .enum([
      'create_spreadsheet',
      'read_range',
      'write_range',
      'append_rows',
      'get_metadata',
      'clear_range',
      'import_csv',
      'export_csv',
    ])
    .describe('Google Sheets operation to perform'),

  title: z
    .string()
    .min(1)
    .optional()
    .describe('Spreadsheet title (create_spreadsheet/import_csv, required)'),
  sheetTitle: z
    .string()
    .optional()
    .describe('Title of the first sheet (create_spreadsheet/import_csv, optional)'),

  spreadsheetId: z
    .string()
    .optional()
    .describe(
      'ID of an existing spreadsheet (read_range/write_range/append_rows/get_metadata/clear_range/import_csv/export_csv, required)',
    ),
  range: z
    .string()
    .optional()
    .describe(
      'A1 notation range e.g. "Sheet1!A1:D10" (read_range/write_range/append_rows/clear_range, required)',
    ),
  values: z
    .array(z.array(z.string()))
    .optional()
    .describe('2D array of values (write_range/append_rows, required)'),

  // G9
  csv: z
    .string()
    .optional()
    .describe(
      'Raw CSV text (import_csv, required). RFC-4180 quoted fields are supported.',
    ),
  csvDelimiter: z
    .enum([',', ';', '\t', '|'])
    .optional()
    .describe('Field delimiter (import_csv, default ",")'),
  hasHeader: z
    .boolean()
    .optional()
    .describe('Treat the first row as a header (import_csv, default true)'),

  majorDimension: z
    .enum(['ROWS', 'COLUMNS'])
    .optional()
    .describe('Dimension orientation (read_range/write_range, default ROWS)'),
});
export type SheetsInput = z.infer<typeof SheetsInputSchema>;

export const SheetsOutputSchema = z.object({
  action: z.string(),
  spreadsheet: z
    .object({
      spreadsheetId: z.string(),
      title: z.string(),
      sheets: z.array(
        z.object({
          sheetId: z.number(),
          title: z.string(),
          index: z.number(),
          rowCount: z.number(),
          columnCount: z.number(),
        }),
      ),
      webViewLink: z.string().optional(),
    })
    .optional(),
  spreadsheetId: z.string().optional(),
  range: z.string().optional(),
  rangeData: z
    .object({
      range: z.string(),
      values: z.array(z.array(z.string())),
      rowCount: z.number().optional(),
      colCount: z.number().optional(),
    })
    .optional(),
  writeResult: z
    .object({
      updatedRange: z.string(),
      updatedRows: z.number(),
      updatedColumns: z.number(),
      updatedCells: z.number(),
    })
    .optional(),
  appendResult: z
    .object({
      updatedRange: z.string(),
      updatedRows: z.number(),
      updatedColumns: z.number(),
    })
    .optional(),
  cleared: z.boolean().optional(),
  // G9 import_csv / export_csv
  importedRows: z.number().optional(),
  importedColumns: z.number().optional(),
  delimiterUsed: z.string().optional(),
  csv: z.string().optional(),
  rowCount: z.number().optional(),
  colCount: z.number().optional(),
  webViewLink: z.string().optional(),
});
export type SheetsOutput = z.infer<typeof SheetsOutputSchema>;

@Injectable()
export class SheetsTool extends BaseStructuredTool {
  readonly name = 'sheets';
  readonly description =
    'Work with Google Sheets spreadsheets. ' +
    "action='create_spreadsheet' creates a new spreadsheet. " +
    "action='read_range' reads cell values from a given range. " +
    "action='write_range' writes values to a range, overwriting existing content. " +
    "action='append_rows' adds new rows after the last data row. " +
    "action='get_metadata' retrieves spreadsheet structure (sheet names, row/column counts). " +
    "action='clear_range' clears values in a range without deleting the cells. " +
    "action='import_csv' creates a new spreadsheet (or writes into an existing one) from raw CSV text; honours csvDelimiter (',' / ';' / '\\t' / '|') and hasHeader (default true). " +
    "action='export_csv' reads a range from an existing spreadsheet and returns CSV text (range defaults to the entire sheet). " +
    'Use this to build reports, track data, maintain ledgers, or import/export tabular information.';
  readonly category = ToolCategory.FILE;
  readonly inputSchema = SheetsInputSchema;
  readonly outputSchema = SheetsOutputSchema;
  readonly requiredPermissions = ['sheets:read', 'sheets:write'];

  constructor(private readonly sheets: GoogleSheetsService) {
    super();
  }

  protected async executeImpl(
    input: SheetsInput,
    context?: Partial<ToolExecutionContext>,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    const tenantId = context?.tenantId;
    if (!tenantId) {
      return {
        success: false,
        error: 'Tenant context required for sheets operations',
      };
    }

    try {
      switch (input.action) {
        case 'create_spreadsheet':
          return await this.createSpreadsheet(tenantId, input);
        case 'read_range':
          return await this.readRange(tenantId, input);
        case 'write_range':
          return await this.writeRange(tenantId, input);
        case 'append_rows':
          return await this.appendRows(tenantId, input);
        case 'get_metadata':
          return await this.getMetadata(tenantId, input);
        case 'clear_range':
          return await this.clearRange(tenantId, input);
        case 'import_csv':
          return await this.importCsv(tenantId, input);
        case 'export_csv':
          return await this.exportCsv(tenantId, input);
        default:
          return {
            success: false,
            error: `Unknown action: ${String(input.action)}`,
          };
      }
    } catch (error) {
      this.logger.error(`SheetsTool [${input.action}] failed`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Sheets operation failed',
      };
    }
  }

  private async createSpreadsheet(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.title) {
      return {
        success: false,
        error: 'title is required for create_spreadsheet',
      };
    }

    const sheets = input.sheetTitle ? [{ title: input.sheetTitle }] : undefined;
    const meta = await this.sheets.createSpreadsheet(tenantId, {
      title: input.title,
      sheets,
    });

    return {
      success: true,
      data: { action: 'create_spreadsheet', spreadsheet: meta },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  private async readRange(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.spreadsheetId || !input.range) {
      return {
        success: false,
        error: 'spreadsheetId and range are required for read_range',
      };
    }

    const data = await this.sheets.readRange(
      tenantId,
      input.spreadsheetId,
      input.range,
      input.majorDimension ?? 'ROWS',
    );

    return {
      success: true,
      data: {
        action: 'read_range',
        rangeData: {
          range: data.range,
          values: data.values,
          rowCount: data.values.length,
          colCount: data.values[0]?.length ?? 0,
        },
      },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  private async writeRange(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.spreadsheetId || !input.range || !input.values) {
      return {
        success: false,
        error: 'spreadsheetId, range, and values are required for write_range',
      };
    }

    const result = await this.sheets.writeRange(tenantId, {
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      values: input.values,
      majorDimension: input.majorDimension,
    });

    return {
      success: true,
      data: { action: 'write_range', writeResult: result },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  private async appendRows(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.spreadsheetId || !input.range || !input.values) {
      return {
        success: false,
        error: 'spreadsheetId, range, and values are required for append_rows',
      };
    }

    const result = await this.sheets.appendRows(tenantId, {
      spreadsheetId: input.spreadsheetId,
      range: input.range,
      values: input.values,
    });

    return {
      success: true,
      data: {
        action: 'append_rows',
        appendResult: {
          updatedRange: result.updatedRange,
          updatedRows: result.updates.updatedRows,
          updatedColumns: result.updates.updatedColumns,
        },
      },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  private async getMetadata(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.spreadsheetId) {
      return {
        success: false,
        error: 'spreadsheetId is required for get_metadata',
      };
    }

    const meta = await this.sheets.getMetadata(tenantId, input.spreadsheetId);

    return {
      success: true,
      data: { action: 'get_metadata', spreadsheet: meta },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  private async clearRange(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.spreadsheetId || !input.range) {
      return {
        success: false,
        error: 'spreadsheetId and range are required for clear_range',
      };
    }

    await this.sheets.clearRange(tenantId, input.spreadsheetId, input.range);

    return {
      success: true,
      data: { action: 'clear_range', cleared: true },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  // ─── G9 import_csv / export_csv ────────────────────────────────────

  /**
   * G9: Create a new spreadsheet from CSV text (or write CSV into an existing one).
   * Honours user-supplied delimiter, optional header row, and quoted fields per RFC 4180.
   */
  private async importCsv(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (input.csv === undefined || input.csv === '') {
      return { success: false, error: 'import_csv requires csv text' };
    }
    if (!input.spreadsheetId && !input.title) {
      return {
        success: false,
        error: 'import_csv requires either spreadsheetId (target existing) or title (new)',
      };
    }

    const delimiter: CsvDelimiter = input.csvDelimiter ?? ',';
    const hasHeader = input.hasHeader ?? true;
    const allRows = parseCsv(input.csv, delimiter);
    if (allRows.length === 0) {
      return { success: false, error: 'CSV parsed to zero rows' };
    }
    const headerRow = hasHeader ? allRows[0] : null;
    const rows = hasHeader ? allRows.slice(1) : allRows;
    if (rows.length === 0) {
      return { success: false, error: 'No data rows after header' };
    }

    let spreadsheetId = input.spreadsheetId;
    let sheetTitle: string | null = input.sheetTitle ?? null;

    if (!spreadsheetId) {
      const created = await this.sheets.createSpreadsheet(tenantId, {
        title: input.title!,
        sheets: input.sheetTitle ? [{ title: input.sheetTitle }] : undefined,
      });
      spreadsheetId = created.spreadsheetId;
      sheetTitle = created.sheets[0]?.title ?? input.sheetTitle ?? 'Sheet1';
    } else if (!sheetTitle) {
      const meta = await this.sheets.getMetadata(tenantId, spreadsheetId);
      sheetTitle = meta.sheets[0]?.title ?? 'Sheet1';
    }

    const startCol = 'A';
    const startRow = 1;
    const rowCount = rows.length;
    const colCount = Math.max(...rows.map((r) => r.length), 1);
    const endCol = colToLetter(startCol.charCodeAt(0) - 65 + colCount);
    const endRow = startRow + rowCount - 1;
    const range = `${sheetTitle}!${startCol}${startRow}:${endCol}${endRow}`;

    const write = await this.sheets.writeRange(tenantId, {
      spreadsheetId,
      range,
      values: rows,
      majorDimension: 'ROWS',
    });

    const meta = await this.sheets.getMetadata(tenantId, spreadsheetId);

    return {
      success: true,
      data: {
        action: 'import_csv',
        spreadsheet: meta,
        spreadsheetId,
        rangeData: {
          range,
          values: rows,
          rowCount,
          colCount,
        },
        writeResult: write,
        importedRows: rowCount,
        importedColumns: colCount,
        delimiterUsed: delimiter,
        webViewLink: meta.webViewLink,
        ...(headerRow ? { header: { hasHeader: true, columns: headerRow } as Record<string, unknown> } : {}),
      },
      metadata: { model: 'sheets-tool-v1' },
    };
  }

  /**
   * G9: Export an existing spreadsheet range to CSV text.
   * Range defaults to the entire first sheet (a single getMetadata + readRange call).
   */
  private async exportCsv(
    tenantId: string,
    input: SheetsInput,
  ): Promise<StructuredToolResult<SheetsOutput>> {
    if (!input.spreadsheetId) {
      return { success: false, error: 'export_csv requires spreadsheetId' };
    }

    let range = input.range;
    if (!range) {
      const meta = await this.sheets.getMetadata(
        tenantId,
        input.spreadsheetId,
      );
      const first = meta.sheets[0];
      if (!first) {
        return { success: false, error: 'Spreadsheet has no sheets' };
      }
      range = `${first.title}`;
    }

    const data = await this.sheets.readRange(
      tenantId,
      input.spreadsheetId,
      range,
      'ROWS',
    );

    const delimiter: CsvDelimiter = input.csvDelimiter ?? ',';
    const csv = toCsv(data.values, delimiter);
    const rowCount = data.values.length;
    const colCount = data.values.reduce((m, r) => Math.max(m, r.length), 0);

    return {
      success: true,
      data: {
        action: 'export_csv',
        spreadsheetId: input.spreadsheetId,
        rangeData: { range, values: data.values, rowCount, colCount },
        csv,
        rowCount,
        colCount,
        delimiterUsed: delimiter,
      },
      metadata: { model: 'sheets-tool-v1' },
    };
  }
}
