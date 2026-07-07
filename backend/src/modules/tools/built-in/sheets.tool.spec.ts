import { SheetsTool } from './sheets.tool';

describe('SheetsTool', () => {
  let tool: SheetsTool;
  const mockSheets = {
    createSpreadsheet: jest.fn(),
    readRange: jest.fn(),
    writeRange: jest.fn(),
    appendRows: jest.fn(),
    getMetadata: jest.fn(),
    clearRange: jest.fn(),
  };
  const tenantId = 'tenant-1';

  beforeEach(() => {
    jest.clearAllMocks();
    tool = new SheetsTool(mockSheets as any);
  });

  describe('create_spreadsheet', () => {
    it('requires title — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'create_spreadsheet' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('title is required for create_spreadsheet');
    });

    it('returns spreadsheet meta with sheets array', async () => {
      const meta = {
        spreadsheetId: 'ss-1',
        title: 'My Sheet',
        sheets: [
          {
            sheetId: 0,
            title: 'Sheet1',
            index: 0,
            rowCount: 1000,
            columnCount: 26,
          },
        ],
        webViewLink: 'https://sheets.google.com/ss-1',
      };
      mockSheets.createSpreadsheet.mockResolvedValue(meta);

      const result = await (tool as any).executeImpl(
        { action: 'create_spreadsheet', title: 'My Sheet' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('create_spreadsheet');
      expect(result.data.spreadsheet).toEqual(meta);
      expect(mockSheets.createSpreadsheet).toHaveBeenCalledWith(tenantId, {
        title: 'My Sheet',
        sheets: undefined,
      });
    });
  });

  describe('read_range', () => {
    it('requires spreadsheetId and range — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'read_range' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'spreadsheetId and range are required for read_range',
      );
    });

    it('returns rangeData with values, rowCount, colCount', async () => {
      mockSheets.readRange.mockResolvedValue({
        range: 'Sheet1!A1:B2',
        values: [
          ['Name', 'Email'],
          ['Alice', 'alice@test.com'],
        ],
      });

      const result = await (tool as any).executeImpl(
        {
          action: 'read_range',
          spreadsheetId: 'ss-1',
          range: 'Sheet1!A1:B2',
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('read_range');
      expect(result.data.rangeData).toEqual({
        range: 'Sheet1!A1:B2',
        values: [
          ['Name', 'Email'],
          ['Alice', 'alice@test.com'],
        ],
        rowCount: 2,
        colCount: 2,
      });
    });
  });

  describe('write_range', () => {
    it('requires spreadsheetId, range, values — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'write_range' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'spreadsheetId, range, and values are required for write_range',
      );
    });

    it('returns writeResult', async () => {
      const writeResult = {
        updatedRange: 'Sheet1!A1:B2',
        updatedRows: 2,
        updatedColumns: 2,
        updatedCells: 4,
      };
      mockSheets.writeRange.mockResolvedValue(writeResult);

      const result = await (tool as any).executeImpl(
        {
          action: 'write_range',
          spreadsheetId: 'ss-1',
          range: 'Sheet1!A1:B2',
          values: [
            ['Name', 'Email'],
            ['Alice', 'alice@test.com'],
          ],
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('write_range');
      expect(result.data.writeResult).toEqual(writeResult);
    });
  });

  describe('append_rows', () => {
    it('requires spreadsheetId, range, values — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'append_rows' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'spreadsheetId, range, and values are required for append_rows',
      );
    });

    it('returns appendResult with updatedRange, updatedRows, updatedColumns', async () => {
      mockSheets.appendRows.mockResolvedValue({
        updatedRange: 'Sheet1!A3:B4',
        updates: { updatedRows: 2, updatedColumns: 2 },
      });

      const result = await (tool as any).executeImpl(
        {
          action: 'append_rows',
          spreadsheetId: 'ss-1',
          range: 'Sheet1!A1:B2',
          values: [
            ['Bob', 'bob@test.com'],
            ['Charlie', 'charlie@test.com'],
          ],
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('append_rows');
      expect(result.data.appendResult).toEqual({
        updatedRange: 'Sheet1!A3:B4',
        updatedRows: 2,
        updatedColumns: 2,
      });
    });
  });

  describe('get_metadata', () => {
    it('requires spreadsheetId — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'get_metadata' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'spreadsheetId is required for get_metadata',
      );
    });

    it('returns spreadsheet meta', async () => {
      const meta = {
        spreadsheetId: 'ss-1',
        title: 'My Sheet',
        sheets: [
          {
            sheetId: 0,
            title: 'Sheet1',
            index: 0,
            rowCount: 100,
            columnCount: 5,
          },
        ],
        webViewLink: 'https://sheets.google.com/ss-1',
      };
      mockSheets.getMetadata.mockResolvedValue(meta);

      const result = await (tool as any).executeImpl(
        { action: 'get_metadata', spreadsheetId: 'ss-1' },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('get_metadata');
      expect(result.data.spreadsheet).toEqual(meta);
      expect(mockSheets.getMetadata).toHaveBeenCalledWith(tenantId, 'ss-1');
    });
  });

  describe('clear_range', () => {
    it('requires spreadsheetId, range — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'clear_range' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'spreadsheetId and range are required for clear_range',
      );
    });

    it('returns { cleared: true }', async () => {
      mockSheets.clearRange.mockResolvedValue(undefined);

      const result = await (tool as any).executeImpl(
        {
          action: 'clear_range',
          spreadsheetId: 'ss-1',
          range: 'Sheet1!A1:D10',
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        action: 'clear_range',
        cleared: true,
      });
      expect(mockSheets.clearRange).toHaveBeenCalledWith(
        tenantId,
        'ss-1',
        'Sheet1!A1:D10',
      );
    });
  });

  describe('import_csv', () => {
    it('with hasHeader=true skips first row as header, writes remaining data rows', async () => {
      const meta = {
        spreadsheetId: 'ss-csv',
        title: 'Imported CSV',
        sheets: [
          { sheetId: 0, title: 'Sheet1', index: 0, rowCount: 1000, columnCount: 26 },
        ],
        webViewLink: 'https://sheets.google.com/ss-csv',
      };
      mockSheets.createSpreadsheet.mockResolvedValue(meta);
      mockSheets.getMetadata.mockResolvedValue(meta);
      mockSheets.writeRange.mockResolvedValue({
        updatedRange: 'Sheet1!A1:C2',
        updatedRows: 2,
        updatedColumns: 3,
        updatedCells: 6,
      });

      const result = await (tool as any).executeImpl(
        {
          action: 'import_csv',
          title: 'Imported CSV',
          csv: 'Name,Email,Phone\nAlice,alice@test.com,123\nBob,bob@test.com,456',
          hasHeader: true,
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('import_csv');
      expect(result.data.importedRows).toBe(2);
      expect(result.data.importedColumns).toBe(3);
      expect(result.data.header).toBeDefined();
      expect(result.data.header.hasHeader).toBe(true);
      expect(result.data.header.columns).toEqual(['Name', 'Email', 'Phone']);

      const writeCall = mockSheets.writeRange.mock.calls[0];
      expect(writeCall[1].values).toEqual([
        ['Alice', 'alice@test.com', '123'],
        ['Bob', 'bob@test.com', '456'],
      ]);
    });

    it('with hasHeader=false writes all rows including first row', async () => {
      const meta = {
        spreadsheetId: 'ss-csv2',
        title: 'No Header',
        sheets: [
          { sheetId: 0, title: 'Sheet1', index: 0, rowCount: 1000, columnCount: 26 },
        ],
        webViewLink: 'https://sheets.google.com/ss-csv2',
      };
      mockSheets.createSpreadsheet.mockResolvedValue(meta);
      mockSheets.getMetadata.mockResolvedValue(meta);
      mockSheets.writeRange.mockResolvedValue({
        updatedRange: 'Sheet1!A1:D3',
        updatedRows: 3,
        updatedColumns: 2,
        updatedCells: 6,
      });

      const result = await (tool as any).executeImpl(
        {
          action: 'import_csv',
          title: 'No Header',
          csv: 'Alice,alice@test.com\nBob,bob@test.com\nCharlie,charlie@test.com',
          hasHeader: false,
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.importedRows).toBe(3);
      expect(result.data.importedColumns).toBe(2);
      expect(result.data.header).toBeUndefined();

      const writeCall = mockSheets.writeRange.mock.calls[0];
      expect(writeCall[1].values).toEqual([
        ['Alice', 'alice@test.com'],
        ['Bob', 'bob@test.com'],
        ['Charlie', 'charlie@test.com'],
      ]);
    });
  });

  describe('export_csv', () => {
    it('requires spreadsheetId — error if missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'export_csv' },
        { tenantId },
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('export_csv requires spreadsheetId');
    });

    it('returns CSV text from sheet range', async () => {
      mockSheets.readRange.mockResolvedValue({
        range: 'Sheet1',
        values: [
          ['Name', 'Email'],
          ['Alice', 'alice@test.com'],
          ['Bob', 'bob@test.com'],
        ],
      });

      const result = await (tool as any).executeImpl(
        {
          action: 'export_csv',
          spreadsheetId: 'ss-1',
          range: 'Sheet1',
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(result.data.action).toBe('export_csv');
      expect(result.data.csv).toBe('Name,Email\nAlice,alice@test.com\nBob,bob@test.com');
      expect(result.data.rowCount).toBe(3);
      expect(result.data.colCount).toBe(2);
      expect(mockSheets.readRange).toHaveBeenCalledWith(
        tenantId,
        'ss-1',
        'Sheet1',
        'ROWS',
      );
    });

    it('auto-detects first sheet when no range provided', async () => {
      const meta = {
        spreadsheetId: 'ss-auto',
        title: 'Auto Sheet',
        sheets: [
          { sheetId: 0, title: 'Data', index: 0, rowCount: 100, columnCount: 10 },
          { sheetId: 1, title: 'Notes', index: 1, rowCount: 50, columnCount: 5 },
        ],
        webViewLink: 'https://sheets.google.com/ss-auto',
      };
      mockSheets.getMetadata.mockResolvedValue(meta);
      mockSheets.readRange.mockResolvedValue({
        range: 'Data',
        values: [['Col1', 'Col2']],
      });

      const result = await (tool as any).executeImpl(
        {
          action: 'export_csv',
          spreadsheetId: 'ss-auto',
        },
        { tenantId },
      );

      expect(result.success).toBe(true);
      expect(mockSheets.getMetadata).toHaveBeenCalledWith(tenantId, 'ss-auto');
      expect(mockSheets.readRange).toHaveBeenCalledWith(
        tenantId,
        'ss-auto',
        'Data',
        'ROWS',
      );
    });
  });

  describe('tenant context', () => {
    it('returns error when tenantId is missing', async () => {
      const result = await (tool as any).executeImpl(
        { action: 'create_spreadsheet', title: 'Test' },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant context required for sheets operations');
    });
  });
});
