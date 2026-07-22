import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const reportConfigSchema = z.object({
  metrics: z.array(z.string().min(1).max(100)).min(1).max(50),
  period: z.enum([
    'daily',
    'weekly',
    'monthly',
    'quarterly',
    'yearly',
    'custom',
  ]),
  format: z.enum(['dashboard', 'table', 'chart', 'pdf', 'csv']),
});

@Injectable()
export class ReportValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'REPORT';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = reportConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}
