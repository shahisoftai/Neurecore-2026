import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const agentRoleConfigSchema = z.object({
  systemPrompt: z.string().min(10).max(10000),
  kpis: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        target: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

@Injectable()
export class AgentRoleValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'AGENT_ROLE';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = agentRoleConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}
