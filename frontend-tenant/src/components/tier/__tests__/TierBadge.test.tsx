// ─── TierBadge tests — Phase 6 ───────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TierBadge, getTierPresentation } from '../TierBadge';

describe('TierBadge', () => {
  describe('render modes', () => {
    it('renders the tier name as non-interactive span when no onClick is passed', () => {
      render(<TierBadge tier={{ slug: 'basic', name: 'Basic' }} />);
      const badge = screen.getByTestId('tier-badge');
      expect(badge.tagName).toBe('SPAN');
      expect(badge).toHaveTextContent('Basic');
    });

    it('renders as a button when onClick is provided', () => {
      render(
        <TierBadge
          tier={{ slug: 'professional', name: 'Professional' }}
          onClick={vi.fn()}
        />,
      );
      const badge = screen.getByTestId('tier-badge-button');
      expect(badge.tagName).toBe('BUTTON');
      expect(badge).toHaveTextContent('Professional');
    });

    it('calls onClick when the button variant is clicked', () => {
      const handler = vi.fn();
      render(
        <TierBadge
          tier={{ slug: 'business', name: 'Business' }}
          onClick={handler}
        />,
      );
      fireEvent.click(screen.getByTestId('tier-badge-button'));
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('trial pill', () => {
    it('shows the TRIAL pill when trialDays is set', () => {
      render(
        <TierBadge
          tier={{ slug: 'basic', name: 'Basic', trialDays: 14 }}
          onClick={vi.fn()}
        />,
      );
      expect(screen.getByText(/Trial · 14d/)).toBeInTheDocument();
    });

    it('does NOT show the trial pill when trialDays is null or zero', () => {
      render(
        <TierBadge
          tier={{ slug: 'basic', name: 'Basic', trialDays: 0 }}
          onClick={vi.fn()}
        />,
      );
      expect(screen.queryByText(/Trial/)).not.toBeInTheDocument();
    });
  });

  describe('tagline in non-compact mode', () => {
    it('shows the tagline when present and compact=false', () => {
      render(
        <TierBadge
          tier={{
            slug: 'enterprise',
            name: 'Enterprise',
            tagline: 'For large organizations',
          }}
        />,
      );
      expect(screen.getByText(/For large organizations/)).toBeInTheDocument();
    });

    it('hides the tagline when compact=true', () => {
      render(
        <TierBadge
          compact
          tier={{
            slug: 'enterprise',
            name: 'Enterprise',
            tagline: 'For large organizations',
          }}
        />,
      );
      expect(screen.queryByText(/For large organizations/)).not.toBeInTheDocument();
    });
  });

  describe('getTierPresentation', () => {
    it('returns the canonical rank for each tier (basic < business < professional < enterprise)', () => {
      const basic = getTierPresentation('basic').rank;
      const business = getTierPresentation('business').rank;
      const professional = getTierPresentation('professional').rank;
      const enterprise = getTierPresentation('enterprise').rank;
      expect(basic).toBeLessThan(business);
      expect(business).toBeLessThan(professional);
      expect(professional).toBeLessThan(enterprise);
    });

    it('returns a safe default for unknown slugs (no crash)', () => {
      const p = getTierPresentation('not-a-real-tier');
      expect(p.rank).toBe(-1);
      expect(p.label).toBe('not-a-real-tier');
    });
  });
});
