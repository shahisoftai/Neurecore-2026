/**
 * WidgetRegistry — the global, in-process registry of every available Widget.
 *
 * Phase 4 / EAOS-2 (`EAOS-implementation-plan.md` §9.5).
 *
 * The Registry is the single source of truth for:
 *   - which Widget definitions are installed
 *   - which Widgets are available for a given entity type
 *   - which aggregations can be computed
 *
 * SOLID: Registry pattern (GoF). The Registry is the only object that
 * knows about all definitions; consumers query it by id or by filter.
 * The Registry itself has exactly one responsibility: provide O(1)
 * lookup + filtered iteration.
 *
 * SRP justification: this file does not validate definitions, does not
 * compute aggregations, does not serialize to the wire. It just stores
 * and looks them up. Validation lives in `widget-registry.validator.ts`
 * (extension point).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { WidgetDefinition, EaosEntityTypeForWidget } from './widget-definition';

@Injectable()
export class WidgetRegistry {
  private readonly logger = new Logger(WidgetRegistry.name);
  private readonly widgets = new Map<string, WidgetDefinition>();

  /**
   * Register a Widget definition. Idempotent — re-registering the same
   * id replaces the previous one (useful for Solution Packs).
   */
  register(widget: WidgetDefinition): void {
    if (!widget.id || widget.id.trim() === '') {
      throw new Error('WidgetRegistry.register: widget.id is required');
    }
    if (this.widgets.has(widget.id)) {
      this.logger.warn(`Widget ${widget.id} re-registered (replacing)`);
    }
    this.widgets.set(widget.id, widget);
  }

  /**
   * Bulk register. Useful at module init time.
   */
  registerAll(widgets: WidgetDefinition[]): void {
    for (const w of widgets) this.register(w);
  }

  /**
   * Get a Widget definition by id, or `undefined`.
   */
  get(id: string): WidgetDefinition | undefined {
    return this.widgets.get(id);
  }

  /**
   * Whether the registry has a Widget with the given id.
   */
  has(id: string): boolean {
    return this.widgets.has(id);
  }

  /**
   * Return every Widget definition.
   */
  list(): WidgetDefinition[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Return every Widget definition applicable to the given entity type.
   */
  listForEntityType(entityType: EaosEntityTypeForWidget): WidgetDefinition[] {
    return this.list().filter((w) => w.entityTypes.includes(entityType));
  }

  /**
   * Return every Widget definition for a given capability.
   */
  listForCapability(
    capability: WidgetDefinition['capability'],
  ): WidgetDefinition[] {
    return this.list().filter((w) => w.capability === capability);
  }

  /**
   * Total count of registered Widgets.
   */
  count(): number {
    return this.widgets.size;
  }

  /**
   * Clear the registry. Test-only.
   */
  clear(): void {
    this.widgets.clear();
  }
}