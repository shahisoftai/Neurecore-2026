'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { GlassPanel } from '@/components/home/GlassPanel';
import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import type { Project, ProjectStatus } from '@/services/projects.service';

interface PortalProject extends Project {
  clientFacing?: boolean;
}

interface PortalDeliverable {
  id: string;
  name: string;
  description: string | null;
  status: string;
  clientFacing: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PortalDocument {
  id: string;
  name: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

const PORTAL_TOKEN_KEY = 'neurecore_portal_token';

function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null;
  const urlToken = new URLSearchParams(window.location.search).get('token');
  if (urlToken) {
    localStorage.setItem(PORTAL_TOKEN_KEY, urlToken);
    return urlToken;
  }
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

const portalApi = {
  async getProject(projectId: string, token: string): Promise<PortalProject | null> {
    const res = await api.get(`/portal/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return unwrapItem(res);
  },

  async listDocuments(projectId: string, token: string): Promise<PortalDocument[]> {
    const res = await api.get(`/portal/projects/${projectId}/documents`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { items } = unwrapList(res);
    return items as PortalDocument[];
  },

  async approveDeliverable(
    projectId: string,
    deliverableId: string,
    token: string,
  ): Promise<void> {
    await api.post(
      `/portal/projects/${projectId}/deliverables/${deliverableId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } },
    );
  },
};

export default function PortalProjectPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const token = getPortalToken();

  const [project, setProject] = useState<PortalProject | null>(null);
  const [deliverables, setDeliverables] = useState<PortalDeliverable[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setError('Missing portal access token. Use ?token=... in the URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [p, docs] = await Promise.all([
        portalApi.getProject(projectId, token),
        portalApi.listDocuments(projectId, token),
      ]);
      setProject(p);

      if (p) {
        try {
          const res = await api.get('/deliverables', {
            params: { projectId, limit: 100 },
            headers: { Authorization: `Bearer ${token}` },
          });
          const { items } = unwrapList(res);
          setDeliverables(
            (items as PortalDeliverable[]).filter((d) => d.clientFacing !== false),
          );
        } catch {
          setDeliverables([]);
        }
      }

      setDocuments(docs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApprove = async (deliverableId: string) => {
    if (!token) return;
    try {
      await portalApi.approveDeliverable(projectId, deliverableId, token);
      setDeliverables((prev) =>
        prev.map((d) =>
          d.id === deliverableId ? { ...d, status: 'APPROVED' } : d,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve deliverable');
    }
  };

  const clientDeliverables = useMemo(
    () => deliverables.filter((d) => d.clientFacing !== false),
    [deliverables],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading project…</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center max-w-md">
          <Briefcase className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-zinc-300 mb-2">
            {error ?? 'Project not found'}
          </h1>
          <p className="text-sm text-zinc-500">
            The project may not exist or the access token is invalid.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassPanel className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-zinc-100">{project.name}</h1>
                {project.customer && (
                  <p className="text-sm text-zinc-400 mt-1">{project.customer.name}</p>
                )}
              </div>
              <StatusBadge status={project.status} size="md" />
            </div>

            {project.description && (
              <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
                {project.description}
              </p>
            )}

            <div className="flex items-center gap-6 mt-4 text-xs text-zinc-500">
              {project.targetDate && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Target: {new Date(project.targetDate).toLocaleDateString()}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Updated: {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <GlassPanel className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-zinc-400" />
              <h2 className="text-base font-semibold text-zinc-200">Deliverables</h2>
            </div>

            {clientDeliverables.length === 0 ? (
              <p className="text-sm text-zinc-500">No deliverables available yet.</p>
            ) : (
              <div className="space-y-3">
                {clientDeliverables.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-surface-border bg-surface-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-zinc-200">{d.name}</div>
                      {d.description && (
                        <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                          {d.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <StatusBadge status={d.status} size="sm" />
                      {d.status !== 'APPROVED' && (
                        <ActionButton
                          variant="primary"
                          size="sm"
                          icon={<CheckCircle className="w-3.5 h-3.5" />}
                          onClick={() => handleApprove(d.id)}
                        >
                          Approve
                        </ActionButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassPanel>
        </motion.div>

        {documents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <GlassPanel className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-zinc-400" />
                <h2 className="text-base font-semibold text-zinc-200">Documents</h2>
              </div>

              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-surface-border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm text-zinc-200 truncate">{doc.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {(doc.fileSize / 1024).toFixed(1)} KB ·{' '}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-surface-muted">
                      {doc.fileType}
                    </span>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </div>
    </div>
  );
}
