/**
 * document-extraction.service.spec.ts — Phase 2E unit tests
 *
 * Covers §9.5: heuristic extractor per question type + accept-candidates flow.
 */

import { DocumentExtractionService } from './document-extraction.service';
import type { ResolvedQuestion } from '../requirements/interfaces/requirements.interface';
import type {
  IResponseRepository,
  InformationResponse,
} from '../responses/interfaces/response.interface';
import type { ICompletenessRepository } from '../completeness/interfaces/completeness.interface';
import { ResponseService } from '../responses/response.service';
import { CompletenessService } from '../completeness/completeness.service';

const QUESTIONS: ResolvedQuestion[] = [
  {
    id: 'core.text',
    packKey: 'core',
    questionId: 'text',
    label: 'Text',
    type: 'TEXT',
    required: true,
    askVia: ['document', 'form'],
  },
  {
    id: 'core.select',
    packKey: 'core',
    questionId: 'select',
    label: 'Select',
    type: 'SELECT',
    required: false,
    options: ['A', 'B', 'C'],
    askVia: ['document', 'form'],
  },
  {
    id: 'core.multi',
    packKey: 'core',
    questionId: 'multi',
    label: 'Multi',
    type: 'MULTI_SELECT',
    required: false,
    options: ['X', 'Y'],
    askVia: ['document', 'form'],
  },
  {
    id: 'core.num',
    packKey: 'core',
    questionId: 'num',
    label: 'Number',
    type: 'NUMBER',
    required: false,
    askVia: ['document', 'form'],
  },
  {
    id: 'core.date',
    packKey: 'core',
    questionId: 'date',
    label: 'Date',
    type: 'DATE',
    required: false,
    askVia: ['document', 'form'],
  },
  {
    id: 'core.bool',
    packKey: 'core',
    questionId: 'bool',
    label: 'Bool',
    type: 'BOOLEAN',
    required: false,
    askVia: ['document', 'form'],
  },
];

function makePrisma(
  project: {
    id: string;
    projectTypeId: string | null;
    customerId: string | null;
  } | null,
) {
  return {
    project: { findUnique: jest.fn().mockResolvedValue(project) },
  } as never;
}

function makeProjectTypes() {
  return {
    getCurrentVersion: jest.fn().mockResolvedValue({
      id: 'v_1',
      projectTypeId: 'pt_1',
      version: 1,
      fieldSchema: [],
      stageTemplate: [],
      approvalTemplate: [],
      goalTemplate: null,
      roleTemplate: null,
      informationRequirements: [],
      createdAt: new Date(),
    }),
  } as never;
}

function makePacks() {
  return { listForProjectType: jest.fn().mockResolvedValue([]) } as never;
}

function makeRequirements() {
  return {
    resolveForProjectType: jest.fn().mockResolvedValue(QUESTIONS),
  } as never;
}

function makeResponseService() {
  const repo: jest.Mocked<IResponseRepository> = {
    findCurrentByEntityAndQuestion: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(
      async (input) =>
        ({
          id: `r_${Math.random()}`,
          entityType: input.entityType,
          entityId: input.entityId,
          questionId: input.questionId,
          value: input.value,
          sourceId: input.sourceId,
          confidence: input.confidence,
          supersededById: null,
          createdAt: new Date(),
        }) as InformationResponse,
    ),
    markSuperseded: jest.fn(),
    listCurrent: jest.fn().mockResolvedValue([]),
    listHistory: jest.fn().mockResolvedValue([]),
  };
  const sourceService = {
    create: jest
      .fn()
      .mockImplementation(
        async (input: { type: string; label: string; confidence: number }) => ({
          id: `src_${Math.random()}`,
          type: input.type,
          label: input.label,
          refType: null,
          refId: null,
          confidence: input.confidence,
          verified: false,
          verifiedBy: null,
          verifiedAt: null,
          createdAt: new Date(),
        }),
      ),
    verify: jest.fn(),
  } as never;
  return new ResponseService(repo, sourceService);
}

function makeCompletenessService() {
  const repo: jest.Mocked<ICompletenessRepository> = {
    upsert: jest.fn().mockImplementation(async (input) => ({
      id: 'cmp_1',
      ...input,
    })),
    findByEntity: jest.fn(),
  } as unknown as jest.Mocked<ICompletenessRepository>;
  return new CompletenessService(repo);
}

function build() {
  const prisma = makePrisma({
    id: 'p1',
    projectTypeId: 'pt_1',
    customerId: null,
  });
  const responseService = makeResponseService();
  const completenessService = makeCompletenessService();
  const svc = new DocumentExtractionService(
    prisma,
    makeProjectTypes(),
    makePacks(),
    makeRequirements(),
    responseService,
    completenessService,
  );
  return { svc, responseService, completenessService };
}

describe('DocumentExtractionService', () => {
  it('extract() returns an ExtractionJob with a documentId', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('hello world', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    expect(job.documentId).toBeTruthy();
    expect(job.fileName).toBe('a.txt');
  });

  it('extract() finds a SELECT candidate', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('The status is A today.', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const sel = job.candidates.find((c) => c.questionId === 'select');
    expect(sel?.value).toBe('A');
  });

  it('extract() finds a NUMBER candidate', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('amount = 42.5', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const num = job.candidates.find((c) => c.questionId === 'num');
    expect(num?.value).toBe(42.5);
  });

  it('extract() finds an ISO DATE candidate', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('due 2026-12-31 ok', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const date = job.candidates.find((c) => c.questionId === 'date');
    expect(date?.value).toBe('2026-12-31T00:00:00.000Z');
  });

  it('extract() finds a BOOLEAN candidate (yes)', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('confirmed yes', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const b = job.candidates.find((c) => c.questionId === 'bool');
    expect(b?.value).toBe(true);
  });

  it('extract() finds MULTI_SELECT hits', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('we picked X and also Y today', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const m = job.candidates.find((c) => c.questionId === 'multi');
    expect(Array.isArray(m?.value)).toBe(true);
    expect((m?.value as string[]).sort()).toEqual(['X', 'Y']);
  });

  it('extract() finds a TEXT candidate (first non-trivial line)', async () => {
    const { svc } = build();
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from(
          '# header\nActual content lives here.\nMore.',
          'utf8',
        ),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const t = job.candidates.find((c) => c.questionId === 'text');
    expect(t?.value).toBe('Actual content lives here.');
  });

  it('acceptCandidates() records only the accepted subset', async () => {
    const { svc, responseService } = build();
    const recordSpy = jest.spyOn(responseService, 'record');
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('The status is B. amount 7. confirmed yes', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );

    const out = await svc.acceptCandidates('p1', 't1', job, ['select', 'bool']);
    expect(out.recorded).toBe(2);
    const recordedIds = recordSpy.mock.calls.map(
      (c) => (c[2] as { questionId: string }).questionId,
    );
    expect(recordedIds).toContain('select');
    expect(recordedIds).toContain('bool');
    expect(recordedIds).not.toContain('num');
  });

  it('acceptCandidates() with empty acceptedQuestionIds records nothing', async () => {
    const { svc, responseService } = build();
    const recordSpy = jest.spyOn(responseService, 'record');
    const job = await svc.extract(
      'p1',
      {
        buffer: Buffer.from('The status is B.', 'utf8'),
        fileName: 'a.txt',
        mimeType: 'text/plain',
      },
      QUESTIONS,
    );
    const out = await svc.acceptCandidates('p1', 't1', job, []);
    expect(out.recorded).toBe(0);
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
