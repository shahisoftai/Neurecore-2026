'use client';
// ─── dept-colors.ts ──────────────────────────────────────────────────────────
// Assigns each department a unique color pair (dark card / light agent cards).
// Color is deterministically chosen from department name hash.

export interface DeptColorPair {
  /** Dark background + border for the department card */
  dark:  { bg: string; border: string; text: string; icon: string };
  /** Light background for agent cards inside this department */
  light: { bg: string; border: string; text: string; accent: string };
}

const PALETTE: DeptColorPair[] = [
  {
    dark:  { bg: 'bg-blue-950/90',    border: 'border-blue-700/60',   text: 'text-blue-300',   icon: 'text-blue-400' },
    light: { bg: 'bg-blue-900/50',    border: 'border-blue-700/40',   text: 'text-blue-200',   accent: 'text-blue-400' },
  },
  {
    dark:  { bg: 'bg-indigo-950/90',  border: 'border-indigo-700/60', text: 'text-indigo-300', icon: 'text-indigo-400' },
    light: { bg: 'bg-indigo-900/50',  border: 'border-indigo-700/40', text: 'text-indigo-200', accent: 'text-indigo-400' },
  },
  {
    dark:  { bg: 'bg-emerald-950/90', border: 'border-emerald-700/60', text: 'text-emerald-300', icon: 'text-emerald-400' },
    light: { bg: 'bg-emerald-900/50', border: 'border-emerald-700/40', text: 'text-emerald-200', accent: 'text-emerald-400' },
  },
  {
    dark:  { bg: 'bg-rose-950/90',    border: 'border-rose-700/60',   text: 'text-rose-300',   icon: 'text-rose-400' },
    light: { bg: 'bg-rose-900/50',    border: 'border-rose-700/40',   text: 'text-rose-200',   accent: 'text-rose-400' },
  },
  {
    dark:  { bg: 'bg-amber-950/90',   border: 'border-amber-700/60',  text: 'text-amber-300',  icon: 'text-amber-400' },
    light: { bg: 'bg-amber-900/50',   border: 'border-amber-700/40',  text: 'text-amber-200',  accent: 'text-amber-400' },
  },
  {
    dark:  { bg: 'bg-sky-950/90',     border: 'border-sky-700/60',    text: 'text-sky-300',    icon: 'text-sky-400' },
    light: { bg: 'bg-sky-900/50',     border: 'border-sky-700/40',    text: 'text-sky-200',    accent: 'text-sky-400' },
  },
  {
    dark:  { bg: 'bg-purple-950/90',  border: 'border-purple-700/60', text: 'text-purple-300', icon: 'text-purple-400' },
    light: { bg: 'bg-purple-900/50',  border: 'border-purple-700/40', text: 'text-purple-200', accent: 'text-purple-400' },
  },
  {
    dark:  { bg: 'bg-teal-950/90',   border: 'border-teal-700/60',  text: 'text-teal-300',  icon: 'text-teal-400' },
    light: { bg: 'bg-teal-900/50',   border: 'border-teal-700/40',  text: 'text-teal-200',  accent: 'text-teal-400' },
  },
  {
    dark:  { bg: 'bg-orange-950/90',  border: 'border-orange-700/60', text: 'text-orange-300', icon: 'text-orange-400' },
    light: { bg: 'bg-orange-900/50',  border: 'border-orange-700/40', text: 'text-orange-200', accent: 'text-orange-400' },
  },
  {
    dark:  { bg: 'bg-cyan-950/90',    border: 'border-cyan-700/60',   text: 'text-cyan-300',   icon: 'text-cyan-400' },
    light: { bg: 'bg-cyan-900/50',    border: 'border-cyan-700/40',   text: 'text-cyan-200',   accent: 'text-cyan-400' },
  },
  {
    dark:  { bg: 'bg-pink-950/90',    border: 'border-pink-700/60',   text: 'text-pink-300',   icon: 'text-pink-400' },
    light: { bg: 'bg-pink-900/50',    border: 'border-pink-700/40',   text: 'text-pink-200',   accent: 'text-pink-400' },
  },
  {
    dark:  { bg: 'bg-lime-950/90',    border: 'border-lime-700/60',   text: 'text-lime-300',   icon: 'text-lime-400' },
    light: { bg: 'bg-lime-900/50',    border: 'border-lime-700/40',   text: 'text-lime-200',   accent: 'text-lime-400' },
  },
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getDeptColors(deptId: string, deptName: string): DeptColorPair {
  const idx = hashString(deptId) % PALETTE.length;
  return PALETTE[idx];
}
