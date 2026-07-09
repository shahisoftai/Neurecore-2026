'use client';

// components/agents/AgentAvatar.tsx — Reusable avatar/picture renderer for AI
// Employees. Resolution order:
//   1. `avatarUrl` (uploaded image, tenant-specific)
//   2. `emoji` (tenant-chosen emoji)
//   3. Initials (first letter of `name`) on a color-tinted background
//
// `color` lets tenants theme the fallback. `size` controls the circle
// diameter (default 40px).

import { useMemo } from 'react';
import { assetUrl } from '@/lib/url';

export interface AgentAvatarProps {
  name: string;
  avatarUrl?: string | null;
  emoji?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // First character of the first word, uppercased.
  return trimmed.charAt(0).toUpperCase();
}

// Map a small set of color names to Tailwind classes. Fallback: zinc.
function colorClasses(color?: string | null): string {
  if (!color) return 'bg-zinc-700 text-zinc-200';
  const normalized = color.trim().toLowerCase();
  const map: Record<string, string> = {
    blue:   'bg-blue-700 text-blue-100',
    purple: 'bg-purple-700 text-purple-100',
    green:  'bg-emerald-700 text-emerald-100',
    red:    'bg-red-700 text-red-100',
    orange: 'bg-orange-700 text-orange-100',
    pink:   'bg-pink-700 text-pink-100',
    yellow: 'bg-yellow-700 text-yellow-100',
    teal:   'bg-teal-700 text-teal-100',
    indigo: 'bg-indigo-700 text-indigo-100',
    gray:   'bg-zinc-700 text-zinc-200',
    grey:   'bg-zinc-700 text-zinc-200',
  };
  return map[normalized] ?? 'bg-zinc-700 text-zinc-200';
}

export function AgentAvatar({
  name,
  avatarUrl,
  emoji,
  color,
  size = 40,
  className = '',
}: AgentAvatarProps) {
  const initial = useMemo(() => initialsOf(name), [name]);
  const dimensionStyle = useMemo(
    () => ({ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(12, Math.round(size * 0.4))}px` }),
    [size],
  );

  if (avatarUrl) {
    return (
      <div
        className={`relative shrink-0 rounded-full overflow-hidden border border-surface-border bg-surface-muted ${className}`}
        style={dimensionStyle}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assetUrl(avatarUrl)}
          alt={name}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  if (emoji) {
    return (
      <div
        className={`relative shrink-0 rounded-full border border-surface-border flex items-center justify-center ${colorClasses(color)} ${className}`}
        style={dimensionStyle}
        aria-label={name}
        title={name}
      >
        <span className="leading-none">{emoji}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative shrink-0 rounded-full border border-surface-border flex items-center justify-center font-semibold ${colorClasses(color)} ${className}`}
      style={dimensionStyle}
      aria-label={name}
      title={name}
    >
      <span className="leading-none">{initial}</span>
    </div>
  );
}