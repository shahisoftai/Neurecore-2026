/**
 * Industry Workflow Templates Service
 *
 * Stage 2 Phase 2D: Service to resolve per-industry workflow/automation templates.
 *
 * Provides access to the industry workflow template registry. Tenants
 * can browse available automation templates for their industry and
 * activate them as configured routines/workflows.
 *
 * SOLID:
 * - SRP: This service ONLY resolves workflow templates.
 * - OCP: New template = add to registry. Zero changes here.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  getWorkflowTemplates,
  getWorkflowTemplate,
  getWorkflowsByCategory,
} from './industry-workflow-definitions';
import type { IndustryWorkflowTemplate } from './industry-workflow-definitions';

@Injectable()
export class IndustryWorkflowTemplatesService {
  private readonly logger = new Logger(IndustryWorkflowTemplatesService.name);

  getTemplates(industryGroup: string): IndustryWorkflowTemplate[] {
    return getWorkflowTemplates(industryGroup);
  }

  getTemplate(
    industryGroup: string,
    slug: string,
  ): IndustryWorkflowTemplate | undefined {
    return getWorkflowTemplate(industryGroup, slug);
  }

  getByCategory(
    industryGroup: string,
    category: string,
  ): IndustryWorkflowTemplate[] {
    return getWorkflowsByCategory(industryGroup, category);
  }

  /**
   * Returns template slugs + names for a given industry group.
   * Used for lightweight API responses — omits detailed config.
   */
  getTemplateList(
    industryGroup: string,
  ): Array<{
    slug: string;
    name: string;
    description: string;
    category: string;
  }> {
    return getWorkflowTemplates(industryGroup).map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  }
}
