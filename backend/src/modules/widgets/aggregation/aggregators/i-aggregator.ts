/**
 * IAggregator — the Strategy interface for widget aggregations.
 *
 * Phase 4 / EAOS-2 (`EAOS-implementation-plan.md` §9.5).
 *
 * Every concrete aggregation (SUM, AVG, COUNT, …) implements this
 * interface. The `AggregationEngine` (Context in the Strategy pattern)
 * picks the correct strategy by `aggregationType` and delegates the work.
 *
 * SOLID:
 *   - OCP: new aggregations are added by creating a new class implementing
 *     this interface and registering it in `AggregationFactory` — no engine
 *     changes.
 *   - SRP: an aggregator turns a numeric array into a single scalar; it
 *     does not know about Prisma, HTTP, or UI.
 */

export interface IAggregator<TResult = number> {
  readonly type: import('../../widget-definition').AggregationType;

  /**
   * Compute the aggregate over the provided values.
   * Returns `null` if the input is empty or undefined (UI shows "—").
   */
  compute(values: ReadonlyArray<number>, params?: Record<string, unknown>): TResult | null;

  /**
   * Type-only discriminator so the Strategy factory can register a
   * heterogeneous map (TResult varies: number vs Trend).
   */
  readonly resultKind?: TResult;
}