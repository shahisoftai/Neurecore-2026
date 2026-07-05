'use client';

// components/wizard/WizardShell.tsx — Page chrome for all 11 sub-wizards.
// PR-1 ships an empty scaffold so the route can resolve. PR-3 fills this with
// step navigation, autosave, and per-wizard step rendering.
//
// The contract is intentionally narrow: any wizard page can render this with
// a title, a list of children (one per step), and standard Back/Skip/Finish
// actions. PR-3 introduces the WizardDefinition-driven rendering.

import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface WizardShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function WizardShell({ title, description, children }: WizardShellProps) {
  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}