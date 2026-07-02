'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Unlink,
  Link2,
  Mail,
  Calendar,
  HardDrive as Drive,
  ChevronRight,
  Sheet,
} from 'lucide-react';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import { integrationsService, type IntegrationsList, type Integration } from '@/services/integrations.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function GoogleIntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  loading,
}: {
  integration: Integration;
  onConnect: () => void;
  onDisconnect: () => void;
  loading: boolean;
}) {
  const scopes = integration.scopes ?? [];
  const hasGmail = scopes.some((s) => s.includes('gmail'));
  const hasDrive = scopes.some((s) => s.includes('drive'));
  const hasCalendar = scopes.some((s) => s.includes('calendar'));
  const hasSheets = scopes.some((s) => s.includes('spreadsheets'));

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-red-500 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Google Workspace</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
          </div>
        </div>
        <Badge variant={integration.connected ? 'default' : 'secondary'}>
          {integration.connected ? (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <XCircle className="w-3 h-3" /> Not Connected
            </span>
          )}
        </Badge>
      </div>

      {integration.connected && (
        <div className="mt-4 flex flex-wrap gap-2">
          {hasGmail && (
            <Badge variant="outline" className="text-xs gap-1">
              <Mail className="w-3 h-3" /> Gmail
            </Badge>
          )}
          {hasDrive && (
            <Badge variant="outline" className="text-xs gap-1">
              <Drive className="w-3 h-3" /> Drive
            </Badge>
          )}
          {hasCalendar && (
            <Badge variant="outline" className="text-xs gap-1">
              <Calendar className="w-3 h-3" /> Calendar
            </Badge>
          )}
          {hasSheets && (
            <Badge variant="outline" className="text-xs gap-1">
              <Sheet className="w-3 h-3" /> Sheets
            </Badge>
          )}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {integration.connected ? (
          <>
            <Link href="/settings/integrations/google">
              <Button size="sm">
                <ChevronRight className="w-4 h-4" /> Manage
              </Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={onDisconnect} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={onConnect} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            Connect Google
          </Button>
        )}
      </div>
    </Card>
  );
}

function BrevoIntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  loading,
}: {
  integration: Integration;
  onConnect: (apiKey: string) => void;
  onDisconnect: () => void;
  loading: boolean;
}) {
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [usage, setUsage] = useState<{
    sentToday: number;
    dailyLimit: number;
    isAtWarning: boolean;
    isAtLimit: boolean;
  } | null>(null);

  const handleConnect = () => {
    if (apiKey.trim()) {
      onConnect(apiKey.trim());
      setShowApiKeyDialog(false);
      setApiKey('');
    }
  };

  // Fetch usage when connected
  useEffect(() => {
    if (!integration.connected) {
      setUsage(null);
      return;
    }
    void integrationsService
      .getBrevoUsage()
      .then(setUsage)
      .catch(() => setUsage(null));
  }, [integration.connected]);

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Brevo (Email Relay)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
            </div>
          </div>
          <Badge variant={integration.connected ? 'default' : 'secondary'}>
            {integration.connected ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Not Connected
              </span>
            )}
          </Badge>
        </div>

        <div className="mt-4 flex gap-2">
          {integration.connected ? (
            <div className="flex items-center gap-2">
              {usage && (
                <Badge
                  variant={usage.isAtLimit ? 'destructive' : usage.isAtWarning ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {usage.sentToday}/{usage.dailyLimit} today
                </Badge>
              )}
              <Button variant="destructive" size="sm" onClick={onDisconnect} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={() => setShowApiKeyDialog(true)} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              Connect Brevo
            </Button>
          )}
        </div>
      </Card>

      <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Brevo</DialogTitle>
            <DialogDescription>
              Enter your Brevo API key to enable agent email aliases. Get your API key from{' '}
              <a
                href="https://app.brevo.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                Brevo Settings <ExternalLink className="w-3 h-3 inline" />
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="brevo-api-key">API Key</Label>
            <Input
              id="brevo-api-key"
              type="password"
              placeholder="xkeys-xxxxx..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowApiKeyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={!apiKey.trim()}>
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SlackIntegrationCard() {
  return (
    <Card className="p-5 opacity-60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 17.688 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM17.688 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 17.688 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 18.956a2.528 2.528 0 0 1-2.523-2.522 2.526 2.526 0 0 1 2.52-2.522h6.313A2.527 2.527 0 0 1 24 17.688a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Slack</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Team notifications and alerts</p>
          </div>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" disabled>
          Notify Me
        </Button>
      </div>
    </Card>
  );
}

function MicrosoftIntegrationCard() {
  return (
    <Card className="p-5 opacity-60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M11.4 0H0v11.4h11.4V0zM24 0H12.6v11.4H24V0zM11.4 12.6H0V24h11.4V12.6zM24 12.6H12.6V24H24V12.6z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Microsoft 365</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Outlook, OneDrive, Teams</p>
          </div>
        </div>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" disabled>
          Notify Me
        </Button>
      </div>
    </Card>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external services to power your AI agents.
          </p>
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-lg border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <IntegrationsContent />
    </Suspense>
  );
}

function IntegrationsContent() {
  const user = useTenantAuth();
  const searchParams = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationsList | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const errorParam = searchParams.get('error');
  const connectedParam = searchParams.get('connected');
  const emailParam = searchParams.get('email');

  useEffect(() => {
    if (errorParam) {
      try {
        setError(atob(errorParam));
      } catch {
        setError('Connection failed');
      }
    }
    if (connectedParam === 'true') {
      setSuccessMessage(emailParam
        ? `Google Workspace connected with ${emailParam}!`
        : 'Google Workspace connected!'
      );
    }
  }, [errorParam, connectedParam, emailParam]);

  const fetchIntegrations = useCallback(async () => {
    try {
      setError(null);
      const data = await integrationsService.listIntegrations();
      setIntegrations(data);
    } catch (err) {
      setError('Failed to load integrations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleGoogleConnect = async () => {
    try {
      setActionLoading('google');
      const { url } = await integrationsService.initiateGoogleOAuth();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to initiate Google OAuth', err);
      setError('Failed to start Google authorization');
      setActionLoading(null);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm('Disconnect Google Workspace? Agents will lose access to Gmail, Drive, and Calendar.')) {
      return;
    }
    try {
      setActionLoading('google');
      await integrationsService.disconnectGoogle();
      await fetchIntegrations();
    } catch (err) {
      setError('Failed to disconnect Google');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBrevoConnect = async (apiKey: string) => {
    try {
      setActionLoading('brevo');
      await integrationsService.connectBrevo(apiKey);
      await fetchIntegrations();
    } catch (err) {
      setError('Failed to connect Brevo. Check your API key.');
      console.error(err);
      setActionLoading(null);
    }
  };

  const handleBrevoDisconnect = async () => {
    if (!confirm('Disconnect Brevo? Agent email aliases will stop working.')) {
      return;
    }
    try {
      setActionLoading('brevo');
      await integrationsService.disconnectBrevo();
      await fetchIntegrations();
    } catch (err) {
      setError('Failed to disconnect Brevo');
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services to power your AI agents.
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive"
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm text-green-500 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {successMessage}
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      <div>
        <h2 className="text-sm font-medium mb-3">Connected</h2>
        <div className="space-y-3">
          {loading ? (
            <>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              {integrations?.google && (
                <GoogleIntegrationCard
                  integration={integrations.google}
                  onConnect={handleGoogleConnect}
                  onDisconnect={handleGoogleDisconnect}
                  loading={actionLoading === 'google'}
                />
              )}
              {integrations?.brevo && (
                <BrevoIntegrationCard
                  integration={integrations.brevo}
                  onConnect={handleBrevoConnect}
                  onDisconnect={handleBrevoDisconnect}
                  loading={actionLoading === 'brevo'}
                />
              )}
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3">Available Integrations</h2>
        <div className="space-y-3">
          <SlackIntegrationCard />
          <MicrosoftIntegrationCard />
        </div>
      </div>
    </div>
  );
}
