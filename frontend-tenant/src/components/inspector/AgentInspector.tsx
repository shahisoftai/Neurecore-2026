'use client';
// AgentInspector - renders full agent profile in inspector panel.
// Tenant-specific profile fields (avatarUrl, designation, bio, color, emoji)
// are read from `metadata.profile` (backend stores there) and are editable
// inline via PATCH /api/v1/agents/:id.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { STATUS_BADGE_CLASS, STATUS_COLOR_MAP } from '@/types/ui.types';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { uploadsService, AGENT_AVATAR_UPLOAD } from '@/services/uploads.service';
import { assetUrl } from '@/lib/url';

interface AgentProfile {
  avatarUrl?: string | null;
  designation?: string | null;
  bio?: string | null;
  color?: string | null;
  emoji?: string | null;
}

interface AgentDetail {
  id: string;
  name: string;
  type: string;
  status: string;
  systemPrompt?: string;
  maxBudget?: number;
  spentBudget?: number;
  maxExecutionTime?: number;
  successRate?: number;
  model?: { name: string; provider: string };
  department?: { name: string };
  tools?: { name: string }[];
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

const PROFILE_COLORS = [
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'pink', label: 'Pink' },
  { value: 'teal', label: 'Teal' },
  { value: 'indigo', label: 'Indigo' },
  { value: 'gray', label: 'Gray' },
];

function extractProfile(metadata?: Record<string, unknown> | null): AgentProfile {
  const p = (metadata?.profile as Record<string, unknown> | undefined) ?? {};
  return {
    avatarUrl: typeof p.avatarUrl === 'string' ? p.avatarUrl : null,
    designation: typeof p.designation === 'string' ? p.designation : null,
    bio: typeof p.bio === 'string' ? p.bio : null,
    color: typeof p.color === 'string' ? p.color : null,
    emoji: typeof p.emoji === 'string' ? p.emoji : null,
  };
}

export function AgentInspector({ id }: { id: string }) {
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable profile state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [designation, setDesignation] = useState('');
  const [bio, setBio] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('');

  const load = () => {
    setLoading(true);
    api
      .get(`/agents/${id}`)
      .then((r) => {
        const data = unwrapItem(r) as AgentDetail | null;
        setAgent(data);
        const p = extractProfile(data?.metadata);
        setAvatarUrl(p.avatarUrl ?? null);
        setDesignation(p.designation ?? '');
        setBio(p.bio ?? '');
        setColor(p.color ?? null);
        setEmoji(p.emoji ?? '');
      })
      .catch(() => setAgent(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > AGENT_AVATAR_UPLOAD.maxBytes) {
      setError(`Avatar exceeds ${AGENT_AVATAR_UPLOAD.maxBytes / (1024 * 1024)} MB limit`);
      return;
    }
    if (!(AGENT_AVATAR_UPLOAD.allowedTypes as readonly string[]).includes(file.type)) {
      setError('Unsupported image type. Use PNG, JPEG, WEBP, or SVG.');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadsService.uploadAgentAvatar(file);
      setAvatarUrl(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        avatarUrl: avatarUrl || null,
        designation: designation.trim() || null,
        bio: bio.trim() || null,
        color: color || null,
        emoji: emoji.trim() || null,
      };
      await api.patch(`/agents/${agent.id}`, payload);
      setEditing(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!agent) return;
    const p = extractProfile(agent.metadata);
    setAvatarUrl(p.avatarUrl ?? null);
    setDesignation(p.designation ?? '');
    setBio(p.bio ?? '');
    setColor(p.color ?? null);
    setEmoji(p.emoji ?? '');
    setError(null);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-surface-muted rounded"
            style={{ width: `${60 + i * 6}%` }}
          />
        ))}
      </div>
    );
  }

  if (!agent) {
    return <div className="p-6 text-zinc-500 text-sm">Agent not found.</div>;
  }

  const statusColor = STATUS_COLOR_MAP[agent.status] ?? 'neutral';
  const budgetPct =
    agent.maxBudget && agent.spentBudget
      ? Math.min(100, Math.round((agent.spentBudget / agent.maxBudget) * 100))
      : null;

  const profile = extractProfile(agent.metadata);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 flex flex-col gap-5"
    >
      {/* Identity */}
      <div className="flex items-start gap-4">
        <AgentAvatar
          name={agent.name}
          avatarUrl={profile.avatarUrl}
          emoji={profile.emoji}
          color={profile.color}
          size={56}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-zinc-100 truncate">{agent.name}</h2>
          {profile.designation && (
            <p className="text-xs text-zinc-400 truncate">{profile.designation}</p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-zinc-500">{agent.type}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASS[statusColor]}`}
            >
              {agent.status}
            </span>
          </div>
          {agent.department && (
            <p className="text-xs text-zinc-600 mt-1">📁 {agent.department.name}</p>
          )}
        </div>
      </div>

      {profile.bio && !editing && (
        <p className="text-xs text-zinc-400 leading-relaxed">{profile.bio}</p>
      )}

      {/* Profile editor */}
      {editing && (
        <div className="flex flex-col gap-3 p-4 rounded-xl border border-surface-border bg-surface/40">
          <div className="flex items-center gap-3">
            <AgentAvatar
              name={agent.name}
              avatarUrl={avatarUrl}
              emoji={emoji || null}
              color={color}
              size={48}
            />
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept={AGENT_AVATAR_UPLOAD.allowedTypes.join(',')}
                className="hidden"
                onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
                disabled={uploading}
              />
              <button
                type="button"
                className="text-xs py-1.5 px-3 rounded-lg bg-surface-muted hover:bg-surface-overlay text-zinc-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : avatarUrl ? 'Replace avatar' : 'Upload avatar'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="text-xs py-1.5 px-3 rounded-lg hover:bg-surface-overlay text-zinc-400 transition-colors"
                  onClick={() => setAvatarUrl(null)}
                  disabled={uploading}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <Field
            label="Designation"
            value={designation}
            onChange={setDesignation}
            placeholder="e.g. Sales Lead, Fleet Manager"
            maxLength={100}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500">Bio</label>
            <textarea
              className="text-xs text-zinc-200 bg-surface p-2 rounded-lg border border-surface-border resize-y min-h-[60px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short bio shown on hover / inspector"
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500">Color</label>
              <select
                className="text-xs text-zinc-200 bg-surface p-2 rounded-lg border border-surface-border"
                value={color ?? ''}
                onChange={(e) => setColor(e.target.value || null)}
              >
                <option value="">Default</option>
                {PROFILE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label="Emoji (optional)"
              value={emoji}
              onChange={setEmoji}
              placeholder="e.g. 🔧"
              maxLength={8}
            />
          </div>

          {error && (
            <p className="text-xs text-status-risk" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              className="flex-1 py-2 text-sm rounded-xl bg-status-ops/10 hover:bg-status-ops/20 text-status-ops border border-status-ops/20 transition-colors font-medium disabled:opacity-50"
              onClick={handleSave}
              disabled={saving || uploading}
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <button
              type="button"
              className="flex-1 py-2 text-sm rounded-xl bg-surface-muted hover:bg-surface-overlay text-zinc-300 transition-colors disabled:opacity-50"
              onClick={handleCancel}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Model */}
      {agent.model && (
        <Row label="Model" value={`${agent.model.provider} / ${agent.model.name}`} />
      )}

      {/* Budget */}
      {agent.maxBudget !== undefined && (
        <div>
          <div className="flex justify-between text-xs text-zinc-500 mb-1">
            <span>Budget Used</span>
            <span>
              ${(agent.spentBudget ?? 0).toFixed(4)} / ${agent.maxBudget}
            </span>
          </div>
          {budgetPct !== null && (
            <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${budgetPct > 80 ? 'bg-status-risk' : budgetPct > 50 ? 'bg-status-warn' : 'bg-status-profit'}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Performance */}
      {agent.successRate !== undefined && (
        <Row label="Success Rate" value={`${agent.successRate}%`} />
      )}

      {/* System prompt */}
      {agent.systemPrompt && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">System Prompt</p>
          <p className="text-xs text-zinc-400 font-mono bg-surface p-3 rounded-lg border border-surface-border leading-relaxed line-clamp-4">
            {agent.systemPrompt}
          </p>
        </div>
      )}

      {/* Tools */}
      {agent.tools && agent.tools.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Connected Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((t) => (
              <span
                key={t.name}
                className="text-xs px-2 py-1 rounded bg-surface-muted text-zinc-300 border border-surface-border"
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <Row label="Created" value={new Date(agent.createdAt).toLocaleDateString()} />

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        <button className="w-full py-2 text-sm rounded-xl bg-status-ops/10 hover:bg-status-ops/20 text-status-ops border border-status-ops/20 transition-colors font-medium">
          View Execution Logs
        </button>
        {!editing && (
          <button
            className="w-full py-2 text-sm rounded-xl bg-surface-muted hover:bg-surface-overlay text-zinc-300 border border-surface-border transition-colors"
            onClick={() => setEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      <input
        type="text"
        className="text-xs text-zinc-200 bg-surface p-2 rounded-lg border border-surface-border"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );
}