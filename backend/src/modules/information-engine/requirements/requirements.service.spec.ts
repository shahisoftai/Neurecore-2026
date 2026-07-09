/**
 * requirements.service.spec.ts — Phase 2B unit tests
 *
 * 6+ cases per §9.2 (resolveForProjectType, validateAnswersAgainstRequirements).
 */

import { BadRequestException } from '@nestjs/common';
import { RequirementsService } from './requirements.service';
import { AdaptiveQuestioningService } from './adaptive-questioning.service';
import type {
  SourceQuestion,
  SourcePack,
  ResolveContext,
} from './interfaces/requirements.interface';

const ctx: ResolveContext = {
  entityType: 'PROJECT',
  entityId: 'p1',
  hasCustomer: false,
  classification: null,
  currentResponses: [],
};

const textQ = (id: string, required = true): SourceQuestion => ({
  id,
  label: id,
  type: 'TEXT',
  required,
});

describe('RequirementsService.resolveForProjectType', () => {
  const svc = new RequirementsService();

  it('returns [] for empty inputs', async () => {
    const r = await svc.resolveForProjectType([], [], ctx);
    expect(r).toEqual([]);
  });

  it('prefixes pack questions with packKey.questionId; inline keeps original id', async () => {
    const r = await svc.resolveForProjectType(
      [textQ('inlineA')],
      [{ key: 'healthcare', questions: [textQ('q1')] }],
      ctx,
    );
    const ids = r.map((q) => q.id);
    expect(ids).toContain('inlineA');
    expect(ids).toContain('healthcare.q1');
  });

  it('preserves order: inline first, then packs in given order', async () => {
    const r = await svc.resolveForProjectType(
      [textQ('z')],
      [
        { key: 'a', questions: [textQ('a1')] },
        { key: 'b', questions: [textQ('b1')] },
      ],
      ctx,
    );
    expect(r.map((q) => q.id)).toEqual(['z', 'a.a1', 'b.b1']);
  });

  it('filters out questions whose appliesWhen evaluates false', async () => {
    const r = await svc.resolveForProjectType(
      [
        textQ('always'),
        {
          ...textQ('needsCustomer'),
          appliesWhen: { hasCustomer: true },
        },
      ],
      [],
      { ...ctx, hasCustomer: false },
    );
    expect(r.map((q) => q.id)).toEqual(['always']);
  });

  it('keeps questions whose appliesWhen passes', async () => {
    const r = await svc.resolveForProjectType(
      [
        {
          ...textQ('clientOnly'),
          appliesWhen: {
            classification: ['CLIENT_ENGAGEMENT'],
          },
        },
      ],
      [],
      { ...ctx, classification: 'CLIENT_ENGAGEMENT' },
    );
    expect(r.length).toBe(1);
  });

  it('throws BadRequestException on malformed pack questions', async () => {
    await expect(
      svc.resolveForProjectType(
        [],
        [
          {
            key: 'bad',
            questions: [{ id: 'x' }] as unknown as SourceQuestion[],
          },
        ],
        ctx,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws on malformed inline requirements', async () => {
    await expect(
      svc.resolveForProjectType(
        [{ id: 'x' } as unknown as SourceQuestion],
        [],
        ctx,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('RequirementsService.validateAnswersAgainstRequirements', () => {
  const svc = new RequirementsService();

  it('returns ok:true when all required questions are answered', () => {
    const r = svc.validateAnswersAgainstRequirements(
      [
        {
          id: 'a',
          packKey: 'inline',
          questionId: 'a',
          label: 'A',
          type: 'TEXT',
          required: true,
          askVia: ['form'],
        },
        {
          id: 'b',
          packKey: 'inline',
          questionId: 'b',
          label: 'B',
          type: 'TEXT',
          required: true,
          askVia: ['form'],
        },
      ],
      [
        { questionId: 'a', value: 'x' },
        { questionId: 'b', value: 'y' },
      ],
    );
    expect(r.ok).toBe(true);
  });

  it('returns missing[] when a required question is unanswered', () => {
    const r = svc.validateAnswersAgainstRequirements(
      [
        {
          id: 'a',
          packKey: 'inline',
          questionId: 'a',
          label: 'A',
          type: 'TEXT',
          required: true,
          askVia: ['form'],
        },
        {
          id: 'b',
          packKey: 'inline',
          questionId: 'b',
          label: 'B',
          type: 'TEXT',
          required: true,
          askVia: ['form'],
        },
      ],
      [{ questionId: 'a', value: 'x' }],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing[0].questionId).toBe('b');
  });

  it('accepts answers keyed by qualified id (packKey.questionId)', () => {
    const r = svc.validateAnswersAgainstRequirements(
      [
        {
          id: 'core.taxYear',
          packKey: 'core',
          questionId: 'taxYear',
          label: 'Tax Year',
          type: 'TEXT',
          required: true,
          askVia: ['form'],
        },
      ],
      [{ questionId: 'core.taxYear', value: '2026' }],
    );
    expect(r.ok).toBe(true);
  });

  it('skips optional questions', () => {
    const r = svc.validateAnswersAgainstRequirements(
      [
        {
          id: 'a',
          packKey: 'inline',
          questionId: 'a',
          label: 'A',
          type: 'TEXT',
          required: false,
          askVia: ['form'],
        },
      ],
      [],
    );
    expect(r.ok).toBe(true);
  });
});

describe('AdaptiveQuestioningService.pickNext', () => {
  const svc = new AdaptiveQuestioningService();

  const qs = [
    {
      id: 'a',
      packKey: 'inline',
      questionId: 'a',
      label: 'A',
      type: 'TEXT' as const,
      required: true,
      askVia: ['form' as const],
    },
    {
      id: 'b',
      packKey: 'inline',
      questionId: 'b',
      label: 'B',
      type: 'TEXT' as const,
      required: true,
      askVia: ['form' as const],
    },
  ];

  it('returns first unresolved question when nothing answered', async () => {
    const r = await svc.pickNext(qs, ctx);
    expect(r?.id).toBe('a');
  });

  it('skips answered questions', async () => {
    const r = await svc.pickNext(qs, {
      ...ctx,
      currentResponses: [{ questionId: 'a', value: 'x', confidence: 100 }],
    });
    expect(r?.id).toBe('b');
  });

  it('returns null when everything answered', async () => {
    const r = await svc.pickNext(qs, {
      ...ctx,
      currentResponses: [
        { questionId: 'a', value: 'x', confidence: 100 },
        { questionId: 'b', value: 'y', confidence: 100 },
      ],
    });
    expect(r).toBeNull();
  });

  it('respects skipIfConfidenceGte threshold', async () => {
    const r = await svc.pickNext(
      [
        {
          id: 'a',
          packKey: 'inline',
          questionId: 'a',
          label: 'A',
          type: 'TEXT',
          required: true,
          skipIfConfidenceGte: 80,
          askVia: ['form'],
        },
      ],
      {
        ...ctx,
        currentResponses: [{ questionId: 'a', value: 'x', confidence: 90 }],
      },
    );
    expect(r).toBeNull();
  });

  it('does NOT skip when below threshold', async () => {
    const r = await svc.pickNext(
      [
        {
          id: 'a',
          packKey: 'inline',
          questionId: 'a',
          label: 'A',
          type: 'TEXT',
          required: true,
          skipIfConfidenceGte: 80,
          askVia: ['form'],
        },
      ],
      {
        ...ctx,
        currentResponses: [{ questionId: 'a', value: 'x', confidence: 50 }],
      },
    );
    expect(r?.id).toBe('a');
  });

  it('is deterministic (same inputs → same next question)', async () => {
    const r1 = await svc.pickNext(qs, ctx);
    const r2 = await svc.pickNext(qs, ctx);
    expect(r1?.id).toBe(r2?.id);
  });
});
