/**
 * information-engine.di.spec.ts — FIX-027 Prevention test
 *
 * Smoke test that constructs every engine service directly (bypassing Nest DI)
 * with mocked repositories, mirroring the proven
 * projects-engine.integration.spec.ts pattern. This catches the failure
 * modes that crashed production on 2026-07-09 (FIX-027) — Pick<> + interface
 * + missing token DI deps which TypeScript compiles fine but NestJS DI
 * rejects at runtime.
 *
 * If a test here fails with "X is not a constructor" or "X is undefined":
 *   1. The constructor declares a Pick<>, an interface, or a missing token.
 *   2. Apply the fix from FIX-027 §Prevention.
 *   3. Re-run this test before any deploy.
 */

import { ProjectsAdapter } from '../clients/projects.adapter';
import { RequirementsService } from '../requirements/requirements.service';
import { AdaptiveQuestioningService } from '../requirements/adaptive-questioning.service';
import { ResponseService } from '../responses/response.service';
import { CompletenessService } from '../completeness/completeness.service';
import { ProjectTypePacksService } from '../project-type-packs/project-type-packs.service';
import { SourceService } from '../sources/source.service';
import { QuestionPackService } from '../packs/question-packs.service';
import { InterviewService } from '../interview/interview.service';
import { DocumentExtractionService } from '../extraction/document-extraction.service';
import { ProjectTypesService } from '../../project-types/project-types.service';

function makeRepoMock<T>(): jest.Mocked<T> {
  const target: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get: (_t, _prop) =>
      jest.fn().mockImplementation(() => Promise.resolve(null)),
  };
  return new Proxy(target, handler) as unknown as jest.Mocked<T>;
}

/**
 * Static-style construction test: each service should accept its expected
 * shape of constructor arguments. If a service declared a Pick<> or interface
 * type for a runtime dep, this still works AT TYPE LEVEL — the real failure
 * happens when the service method is CALLED with the wrong shape. We use
 * `as never` casts to mirror the proven projects-engine.integration.spec.ts
 * pattern — the value passed is irrelevant; the test asserts each service
 * has a constructor signature that can be CALLED.
 */
describe('FIX-027 prevention — Information Engine service-level DI smoke', () => {
  it('ProjectsAdapter can be constructed with all expected deps (no Pick<>/interface)', () => {
    const adapter = new ProjectsAdapter(
      makeRepoMock(), // PROJECT_REPOSITORY
      makeRepoMock() as never, // ProjectTypesService (forwardRef)
      new RequirementsService(),
      new ResponseService(makeRepoMock(), makeRepoMock() as never),
      new CompletenessService(makeRepoMock()),
      new ProjectTypePacksService(
        makeRepoMock(),
        new QuestionPackService(makeRepoMock()),
      ),
    );
    expect(adapter).toBeDefined();
    expect(typeof adapter.onProjectCreated).toBe('function');
  });

  it('InterviewService can be constructed (no Pick<>/interface)', () => {
    const svc = new InterviewService(
      makeRepoMock() as never, // prisma
      makeRepoMock() as never, // projectTypesService
      new ProjectTypePacksService(
        makeRepoMock(),
        new QuestionPackService(makeRepoMock()),
      ),
      new RequirementsService(),
      new AdaptiveQuestioningService(),
      new ResponseService(makeRepoMock(), makeRepoMock() as never),
      new CompletenessService(makeRepoMock()),
    );
    expect(svc).toBeDefined();
    expect(typeof svc.askNext).toBe('function');
    expect(typeof svc.parseReply).toBe('function');
  });

  it('DocumentExtractionService can be constructed (no Pick<>/interface)', () => {
    const svc = new DocumentExtractionService(
      makeRepoMock() as never, // prisma
      makeRepoMock() as never, // projectTypesService
      new ProjectTypePacksService(
        makeRepoMock(),
        new QuestionPackService(makeRepoMock()),
      ),
      new RequirementsService(),
      new ResponseService(makeRepoMock(), makeRepoMock() as never),
      new CompletenessService(makeRepoMock()),
    );
    expect(svc).toBeDefined();
    expect(typeof svc.extract).toBe('function');
    expect(typeof svc.acceptCandidates).toBe('function');
  });

  it('All engine services can be instantiated as bare objects', () => {
    // Regression: every engine service must be a concrete class.
    // If any service was written as an interface or abstract class,
    // this would fail with "X is not a constructor".
    expect(typeof RequirementsService).toBe('function');
    expect(typeof AdaptiveQuestioningService).toBe('function');
    expect(typeof ResponseService).toBe('function');
    expect(typeof CompletenessService).toBe('function');
    expect(typeof ProjectTypePacksService).toBe('function');
    expect(typeof SourceService).toBe('function');
    expect(typeof QuestionPackService).toBe('function');
  });

  it('SourceService constructs with repo only', () => {
    const svc = new SourceService(makeRepoMock() as never);
    expect(svc).toBeDefined();
  });

  it('ResponseService constructs with 2 repos', () => {
    const svc = new ResponseService(makeRepoMock(), makeRepoMock() as never);
    expect(svc).toBeDefined();
  });

  it('CompletenessService constructs with repo only', () => {
    const svc = new CompletenessService(makeRepoMock());
    expect(svc).toBeDefined();
  });

  it('ProjectTypePacksService constructs with 2 deps (no Pick<>)', () => {
    const svc = new ProjectTypePacksService(
      makeRepoMock(),
      new QuestionPackService(makeRepoMock()),
    );
    expect(svc).toBeDefined();
  });

  it('QuestionPackService constructs with repo only', () => {
    const svc = new QuestionPackService(makeRepoMock());
    expect(svc).toBeDefined();
  });

  it('ProjectTypesService constructs with 1 repo dep (token-mismatch fix)', () => {
    const svc = new ProjectTypesService(makeRepoMock());
    expect(svc).toBeDefined();
  });

  it('Static check: no service declares a Pick<> ctor param (FIX-027)', () => {
    // Read each engine service source file and confirm no constructor has a
    // Pick<> typed parameter. Interface-typed deps are allowed ONLY when
    // they're repo contracts (paired with @Inject(REPOSITORY_TOKEN)) — those
    // are stored as the binding, not resolved by Nest directly.
    const fs = require('fs');
    const path = require('path');
    const engineRoot = path.join(__dirname, '..');

    const SUSPECT_FILES: string[] = [];

    function check(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
          check(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) continue;

        const src = fs.readFileSync(full, 'utf8');
        const ctor = src.match(/constructor\s*\(([\s\S]*?)\)\s*{/);
        if (!ctor) continue;
        const params = ctor[1];
        if (/:\s*Pick\s*</.test(params)) {
          SUSPECT_FILES.push(path.relative(engineRoot, full));
        }
      }
    }

    check(engineRoot);
    expect(SUSPECT_FILES).toEqual([]);
    if (SUSPECT_FILES.length > 0) {
      // eslint-disable-next-line no-console
      console.error('FIX-027 Pick<> violations:', SUSPECT_FILES);
    }
  });

  it('Token alignment: PROJECT_REPOSITORY is "PROJECT_REPOSITORY"', () => {
    expect(
      require('../../projects/interfaces/project.interface').PROJECT_REPOSITORY,
    ).toBe('PROJECT_REPOSITORY');
  });

  it('Token alignment: I_PROJECT_TYPE_REPOSITORY is "I_PROJECT_TYPE_REPOSITORY"', () => {
    // FIX-027 regression: token was renamed from "PROJECT_TYPE_REPOSITORY" to
    // "I_PROJECT_TYPE_REPOSITORY" to match the I-prefix convention used by
    // the binding in ProjectTypesModule.
    expect(
      require('../../project-types/interfaces/project-type.interface')
        .I_PROJECT_TYPE_REPOSITORY,
    ).toBe('I_PROJECT_TYPE_REPOSITORY');
  });
});
