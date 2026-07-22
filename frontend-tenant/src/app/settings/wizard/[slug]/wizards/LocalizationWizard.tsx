'use client';

import { useState } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { tenantsService } from '@/services/tenants.service';
import { useOnboardingChecklistStore } from '@/stores/onboardingChecklist.store';
import type { WizardSlug } from '@/lib/wizard/types';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'Pacific/Auckland',
];

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'PKR', label: 'PKR — Pakistani Rupee' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'CHF', label: 'CHF — Swiss Franc' },
  { code: 'CNY', label: 'CNY — Chinese Yuan' },
];

const LOCALES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'de-DE', label: 'German (Germany)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'ur-PK', label: 'Urdu (Pakistan)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'ar-AE', label: 'Arabic (UAE)' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'ja-JP', label: 'Japanese (Japan)' },
];

export function LocalizationWizard({ slug }: { slug: WizardSlug }) {
  const [timezone, setTimezone] = useState('UTC');
  const [currency, setCurrency] = useState('USD');
  const [locale, setLocale] = useState('en-US');
  const [dateFormat, setDateFormat] = useState('medium');
  const [timeFormat, setTimeFormat] = useState('12h');
  const [fiscalYearStart, setFiscalYearStart] = useState('january');
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storeComplete = useOnboardingChecklistStore((s) => s.complete);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await tenantsService.updateMine({
        timezone,
        currency,
        locale,
        dateFormat,
        timeFormat,
        fiscalYearStart,
      } as Record<string, unknown>);
      await storeComplete(slug);
      setCompleted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (completed) {
    return (
      <WizardShell title="Localization & Currency">
        <div className="text-center space-y-3 py-4">
          <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
          <p className="text-sm text-muted-foreground">Localization saved.</p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell title="Localization & Currency" description="Set timezone, locale, currency, and date format.">
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tz">Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="tz"><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="cur"><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="locale">Locale</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger id="locale"><SelectValue /></SelectTrigger>
            <SelectContent>{LOCALES.map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="df">Date format</Label>
            <Select value={dateFormat} onValueChange={setDateFormat}>
              <SelectTrigger id="df"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short (1/15/26)</SelectItem>
                <SelectItem value="medium">Medium (Jan 15, 2026)</SelectItem>
                <SelectItem value="long">Long (January 15, 2026)</SelectItem>
                <SelectItem value="relative">Relative (2 days ago)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tf">Time format</Label>
            <Select value={timeFormat} onValueChange={setTimeFormat}>
              <SelectTrigger id="tf"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="12h">12-hour (3:42 PM)</SelectItem>
                <SelectItem value="24h">24-hour (15:42)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fiscal">Fiscal year start</Label>
          <Select value={fiscalYearStart} onValueChange={setFiscalYearStart}>
            <SelectTrigger id="fiscal"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['january','february','march','april','may','june','july','august','september','october','november','december'].map((m) => (
                <SelectItem key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save & complete
          </Button>
        </div>
      </div>
    </WizardShell>
  );
}
