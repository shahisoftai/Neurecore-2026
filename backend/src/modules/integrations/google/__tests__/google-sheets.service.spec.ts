import { GoogleSheetsService } from '../google-sheets.service';
import type { GoogleAuthClient } from '../google-auth.client';

const authClient = {
  getAccessToken: jest.fn().mockResolvedValue('fake-access-token'),
} as unknown as GoogleAuthClient;

function makeService(): GoogleSheetsService {
  return new GoogleSheetsService(authClient);
}

interface FetchCall {
  url: string;
  init: RequestInit;
}

let fetchSpy: jest.SpyInstance;

function lastCall(): FetchCall {
  const call = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
  return { url: call[0] as string, init: (call[1] ?? {}) as RequestInit };
}

beforeEach(() => {
  fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
      json: () => Promise.resolve({}),
    } as Response),
  );
});

afterEach(() => {
  fetchSpy.mockRestore();
  (authClient.getAccessToken as jest.Mock).mockReset();
  (authClient.getAccessToken as jest.Mock).mockResolvedValue('fake-access-token');
});

describe('GoogleSheetsService.createSpreadsheet', () => {
  it('creates with title in properties', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            spreadsheetId: 'sp-1',
            properties: { title: 'My Sheet' },
            sheets: [],
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp-1',
          }),
      } as Response),
    );

    const result = await svc.createSpreadsheet('tenant-1', { title: 'My Sheet' });

    const { init } = lastCall();
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.properties.title).toBe('My Sheet');

    expect(result.spreadsheetId).toBe('sp-1');
    expect(result.title).toBe('My Sheet');
    expect(result.webViewLink).toBe('https://docs.google.com/spreadsheets/d/sp-1');
  });

  it('creates with named sheets (grid properties)', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            spreadsheetId: 'sp-2',
            properties: { title: 'Multi-Sheet' },
            sheets: [
              { properties: { sheetId: 0, title: 'Data', index: 0, gridProperties: { rowCount: 500, columnCount: 10 } } },
            ],
          }),
      } as Response),
    );

    await svc.createSpreadsheet('tenant-1', {
      title: 'Multi-Sheet',
      sheets: [{ title: 'Data', rowCount: 500, columnCount: 10 }],
    });

    const { init } = lastCall();
    const body = JSON.parse(init.body as string);
    expect(body.sheets).toEqual([
      {
        properties: {
          title: 'Data',
          gridProperties: { rowCount: 500, columnCount: 10 },
        },
      },
    ]);
  });
});

describe('GoogleSheetsService.readRange', () => {
  it('returns values and majorDimension from API', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            range: 'Sheet1!A1:B2',
            majorDimension: 'ROWS',
            values: [['Name', 'Age'], ['Alice', '30']],
          }),
      } as Response),
    );

    const result = await svc.readRange('tenant-1', 'sp-1', 'Sheet1!A1:B2');

    expect(result).toEqual({
      range: 'Sheet1!A1:B2',
      majorDimension: 'ROWS',
      values: [['Name', 'Age'], ['Alice', '30']],
    });
  });

  it('passes majorDimension/valueRenderOption/dateTimeRenderOption params', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({ range: 'Sheet1', values: [] }),
      } as Response),
    );

    await svc.readRange('tenant-1', 'sp-1', 'Sheet1!A1:D10', 'COLUMNS');

    const { url } = lastCall();
    expect(url).toContain('majorDimension=COLUMNS');
    expect(url).toContain('valueRenderOption=FORMATTED_VALUE');
    expect(url).toContain('dateTimeRenderOption=FORMATTED_STRING');
  });
});

describe('GoogleSheetsService.writeRange', () => {
  it('sends PUT with USER_ENTERED valueInputOption', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            updatedRange: 'Sheet1!A1:B2',
            updatedRows: 2,
            updatedColumns: 2,
            updatedCells: 4,
          }),
      } as Response),
    );

    const result = await svc.writeRange('tenant-1', {
      spreadsheetId: 'sp-1',
      range: 'Sheet1!A1:B2',
      values: [['Name', 'Age']],
    });

    const { url, init } = lastCall();
    expect(init.method).toBe('PUT');
    expect(url).toContain('valueInputOption=USER_ENTERED');
    expect(result.updatedCells).toBe(4);
  });
});

describe('GoogleSheetsService.appendRows', () => {
  it('sends POST with INSERT_ROWS insertDataOption', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            updatedRange: 'Sheet1!A3:B3',
            updates: { updatedRows: 1, updatedColumns: 2 },
          }),
      } as Response),
    );

    const result = await svc.appendRows('tenant-1', {
      spreadsheetId: 'sp-1',
      range: 'Sheet1',
      values: [['Bob', '25']],
    });

    const { url, init } = lastCall();
    expect(init.method).toBe('POST');
    expect(url).toContain(':append');
    expect(url).toContain('insertDataOption=INSERT_ROWS');
    expect(url).toContain('valueInputOption=USER_ENTERED');
    expect(result.updates.updatedRows).toBe(1);
  });
});

describe('GoogleSheetsService.getMetadata', () => {
  it('fetches with fields param (sheetId, title, index, gridProperties, spreadsheetUrl)', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            spreadsheetId: 'sp-1',
            properties: { title: 'My Sheet' },
            sheets: [
              { properties: { sheetId: 0, title: 'Sheet1', index: 0, gridProperties: { rowCount: 1000, columnCount: 26 } } },
            ],
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp-1',
          }),
      } as Response),
    );

    const result = await svc.getMetadata('tenant-1', 'sp-1');

    const { url } = lastCall();
    expect(url).toContain('fields=');
    expect(url).toContain('sheets.properties');
    expect(url).toContain('spreadsheetUrl');

    expect(result.spreadsheetId).toBe('sp-1');
    expect(result.sheets[0].sheetId).toBe(0);
    expect(result.sheets[0].title).toBe('Sheet1');
    expect(result.sheets[0].rowCount).toBe(1000);
    expect(result.sheets[0].columnCount).toBe(26);
  });

  it('parses webViewLink from spreadsheetUrl', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            spreadsheetId: 'sp-2',
            properties: { title: 'Linked Sheet' },
            sheets: [],
            spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/sp-2/edit',
          }),
      } as Response),
    );

    const result = await svc.getMetadata('tenant-1', 'sp-2');

    expect(result.webViewLink).toBe('https://docs.google.com/spreadsheets/d/sp-2/edit');
  });
});

describe('GoogleSheetsService.clearRange', () => {
  it('sends POST to :clear endpoint', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () => Promise.resolve({}),
      } as Response),
    );

    await svc.clearRange('tenant-1', 'sp-1', 'Sheet1!A1:Z100');

    const { url, init } = lastCall();
    expect(init.method).toBe('POST');
    expect(url).toContain('/values/Sheet1!A1%3AZ100:clear');
  });
});

describe('GoogleSheetsService.batchUpdate', () => {
  it('sends POST to :batchUpdate with requests array', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({ replies: [{ addSheet: { properties: { sheetId: 1, title: 'NewSheet' } } }] }),
      } as Response),
    );

    const result = await svc.batchUpdate('tenant-1', 'sp-1', {
      requests: [{ addSheet: { properties: { title: 'NewSheet' } } }],
    });

    const { url, init } = lastCall();
    expect(init.method).toBe('POST');
    expect(url).toContain(':batchUpdate');
    const body = JSON.parse(init.body as string);
    expect(body.requests).toEqual([{ addSheet: { properties: { title: 'NewSheet' } } }]);
    expect(result.replies).toBeDefined();
  });
});

describe('GoogleSheetsService.copySheet', () => {
  it('sends POST to sheets:copyTo and returns parsed result', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(''),
        json: () =>
          Promise.resolve({
            sheetId: 42,
            title: 'CopiedSheet',
            index: 3,
            spreadsheetId: 'dest-sp',
          }),
      } as Response),
    );

    const result = await svc.copySheet('tenant-1', {
      spreadsheetId: 'src-sp',
      sheetId: 7,
      destinationSpreadsheetId: 'dest-sp',
    });

    const { url, init } = lastCall();
    expect(init.method).toBe('POST');
    expect(url).toContain('/sheets/7:copyTo');
    const body = JSON.parse(init.body as string);
    expect(body.destinationSpreadsheetId).toBe('dest-sp');

    expect(result).toEqual({
      sheetId: 42,
      title: 'CopiedSheet',
      index: 3,
      spreadsheetId: 'dest-sp',
    });
  });
});

describe('GoogleSheetsService — auth failure / non-OK', () => {
  it('throws BadRequestException on null access token', async () => {
    const svc = makeService();
    (authClient.getAccessToken as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.createSpreadsheet('tenant-1', { title: 'X' })).rejects.toThrow('Google is not connected');
  });

  it('throws BadRequestException on non-OK response for createSpreadsheet', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error'),
        json: () => Promise.resolve({}),
      } as Response),
    );

    await expect(svc.createSpreadsheet('tenant-1', { title: 'X' })).rejects.toThrow('Failed to create spreadsheet');
  });

  it('throws BadRequestException on non-OK response for readRange', async () => {
    const svc = makeService();
    fetchSpy.mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
        json: () => Promise.resolve({}),
      } as Response),
    );

    await expect(svc.readRange('tenant-1', 'sp-1', 'Sheet1!A1')).rejects.toThrow('Failed to read spreadsheet range');
  });
});
