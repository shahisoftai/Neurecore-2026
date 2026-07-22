import { TemplateType } from '@prisma/client';

export const VALIDATORS_TOKEN = 'TEMPLATE_VALIDATORS';

export interface TemplateValidator {
  templateType: TemplateType;
  validate(config: unknown): { valid: boolean; errors: string[] };
}
