/**
 * ProjectTypePack — Interfaces (Phase 2B)
 */

export const PROJECT_TYPE_PACK_REPOSITORY = 'PROJECT_TYPE_PACK_REPOSITORY';

export type ProjectTypePackLink = {
  projectTypeId: string;
  questionPackId: string;
  sortOrder: number;
};

export type ProjectTypePackWithPack = ProjectTypePackLink & {
  questionPack: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    questions: unknown[];
    version: number;
    isSystem: boolean;
  };
};

export interface IProjectTypePackRepository {
  listForProjectType(projectTypeId: string): Promise<ProjectTypePackWithPack[]>;
  replaceForProjectType(
    projectTypeId: string,
    links: Array<{ questionPackId: string; sortOrder: number }>,
  ): Promise<ProjectTypePackWithPack[]>;
}

export interface IProjectTypePackService {
  listForProjectType(projectTypeId: string): Promise<ProjectTypePackWithPack[]>;
  replaceForProjectType(
    projectTypeId: string,
    packIds: string[],
  ): Promise<ProjectTypePackWithPack[]>;
}
