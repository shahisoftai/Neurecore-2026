'use client';

/**
 * FormField — Creatio-style form input primitives.
 *
 * Reusable, themed wrappers around text input, textarea, select, and
 * date input. Handles label, error, hint, and required-state visuals.
 */

import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

const BASE = 'w-full bg-surface-overlay border border-surface-border rounded-md px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500 transition disabled:opacity-50 disabled:cursor-not-allowed';

const LABEL_CLS = 'block text-xs font-medium text-zinc-300 mb-1';

function FieldShell({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className={LABEL_CLS}>
          {label}
          {required && <span className="text-state-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-state-danger mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-zinc-500 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, required, ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error}>
      <input className={BASE} required={required} {...rest} />
    </FieldShell>
  );
}

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, required, rows = 3, ...rest }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error}>
      <textarea className={`${BASE} resize-y`} rows={rows} required={required} {...rest} />
    </FieldShell>
  );
}

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function SelectField({ label, hint, error, required, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error}>
      <select className={BASE} required={required} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
  error?: string;
}

export function DateField({ label, hint, error, required, ...rest }: DateFieldProps) {
  return (
    <FieldShell label={label} required={required} hint={hint} error={error}>
      <input type="date" className={BASE} required={required} {...rest} />
    </FieldShell>
  );
}