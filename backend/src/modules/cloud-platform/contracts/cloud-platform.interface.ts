/**
 * Cloud Platform — contracts (Phase 11). Control plane for global federation,
 * multi-region architecture, tenant placement, routing, failover, replication,
 * and global health. The control plane models cloud topology — actual multi-
 * region infrastructure (K8s, DNS, load balancers) is cloud operations.
 */

export type RegionStatus = 'ACTIVE' | 'DEGRADED' | 'UNAVAILABLE' | 'PLANNED';
export type Grade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';

export interface RegionView { id: string; name: string; status: RegionStatus; endpoint: string; clusterCount: number }
export interface ClusterView { id: string; regionName: string; name: string; healthy: boolean; endpoint: string | null }
export interface TenantPlacementView { tenantId: string; primaryRegion: string; backupRegion: string | null; residencyPolicy: string | null; replicationEnabled: boolean; failoverStatus: string }
export interface RoutingDecision { region: string; endpoint: string; reason: string; healthy: boolean }
export interface FailoverResult { success: boolean; fromRegion: string; toRegion: string; reason: string; durationMs: number }
export interface GlobalHealth { overall: Grade; regions: { name: string; status: RegionStatus; clusterCount: number }[]; failoverActive: boolean }

export const CLOUD_PLATFORM = Symbol('CLOUD_PLATFORM');
export interface ICloudPlatform {
  // Regions
  registerRegion(tenantId: string, name: string, endpoint: string): Promise<RegionView>;
  listRegions(tenantId: string): Promise<RegionView[]>;
  // Clusters
  registerCluster(regionId: string, name: string, endpoint?: string): Promise<ClusterView>;
  // Tenant placement (deterministic routing)
  place(tenantId: string, primaryRegion: string, backupRegion?: string, residencyPolicy?: string): Promise<TenantPlacementView>;
  getPlacement(tenantId: string): Promise<TenantPlacementView | null>;
  // Routing
  route(tenantId: string): Promise<RoutingDecision>;
  // Failover
  failover(tenantId: string, targetRegion: string): Promise<FailoverResult>;
  // Health
  globalHealth(tenantId: string): Promise<GlobalHealth>;
}
