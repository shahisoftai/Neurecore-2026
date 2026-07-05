import api from './api';

export interface DepartmentTemplateStructureItem {
  name: string;
  description?: string;
  headAgentType?: string;
  parentName?: string;
}

export interface DepartmentTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  structure: DepartmentTemplateStructureItem[];
  category?: string;
  tags?: string[];
}

export const departmentTemplatesService = {
  async list(): Promise<DepartmentTemplate[]> {
    const res = await api.get('/department-templates');
    // Backend returns PaginatedResponse<DepartmentTemplate>:
    //   { status, data: { data: T[], total, page, limit, totalPages }, meta }
    // Older unwrapped endpoints return T[] directly. Handle both.
    const outer = res.data?.data ?? res.data;
    if (Array.isArray(outer)) return outer;
    if (Array.isArray(outer?.data)) return outer.data;
    if (Array.isArray(outer?.items)) return outer.items;
    return [];
  },
};