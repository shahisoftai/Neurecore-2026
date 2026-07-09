/**
 * ProjectMembers Module
 */

import { Module } from '@nestjs/common';
import { ProjectMembersController } from './project-members.controller';
import { ProjectMembersService } from './project-members.service';
import { PrismaProjectMemberRepository } from './repositories/prisma-project-member.repository';
import { PROJECT_MEMBER_REPOSITORY } from './interfaces/project-member.interface';

@Module({
  controllers: [ProjectMembersController],
  providers: [
    ProjectMembersService,
    {
      provide: PROJECT_MEMBER_REPOSITORY,
      useClass: PrismaProjectMemberRepository,
    },
  ],
  exports: [ProjectMembersService],
})
export class ProjectMembersModule {}
