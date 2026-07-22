import { TemplateType } from '@prisma/client';

export interface TemplateValidator {
  templateType: TemplateType;
  validate(config: unknown): { valid: boolean; errors: string[] };
}
