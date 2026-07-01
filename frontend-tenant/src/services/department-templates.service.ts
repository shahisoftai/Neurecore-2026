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
    const payload = res.data?.data ?? res.data;
    return Array.isArray(payload) ? payload : (payload?.items ?? []);
  },
};