/**
 * ProjectTypes — Allocator Module (Phase 2G)
 *
 * Singleton module exposing the ProjectTypeAllocatorService.
 * Lives under the existing `project-types` module boundary.
 */

import { Module } from '@nestjs/common';
import { ProjectTypeAllocatorService } from './project-type-allocator.service';

@Module({
  providers: [ProjectTypeAllocatorService],
  exports: [ProjectTypeAllocatorService],
})
export class ProjectTypeAllocatorModule {}