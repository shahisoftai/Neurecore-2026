'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Unlink,
  Mail,
  Calendar,
  Drive,
  Sheet,
  Folder,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import { integrationsService } from '@/services/integrations.service';
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

interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  children: DriveFolder[];
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
  scopes?: string[];
}

function ManageGoogleContent() {
  const user = useTenantAuth();
  const router = useRouter();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([
        integrationsService.getGoogleStatus(),
        integrationsService.getGoogleDriveFolders().catch(() => ({
          rootFolderId: null,
          children: [],
        })),
      ]);
      setStatus(s as GoogleStatus);
      setFolders((f as { children: DriveFolder[] }).children ?? []);
      setRootFolderId((f as { rootFolderId: string | null }).rootFolderId ?? null);
    } catch (err) {
      setError('Failed to load Google connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleDisconnect = async () => {
    setActionLoading(true);
    try {
      await integrationsService.disconnectGoogle();
      setConfirmDisconnect(false);
      await fetchAll();
    } catch (err) {
      setError('Failed to disconnect Google.');
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const scopes = status?.scopes ?? [];
  const hasGmail = scopes.some((s) => s.includes('gmail'));
  const hasDrive = scopes.some((s) => s.includes('drive'));
  const hasCalendar = scopes.some((s) => s.includes('calendar'));
  const hasSheets = scopes.some((s) => s.includes('spreadsheets'));

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/settings/integrations">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Google Workspace</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Connected account</div>
            <div className="font-medium mt-1">{status?.email ?? '—'}</div>
          </div>
          <Badge variant={status?.connected ? 'default' : 'secondary'}>
            {status?.connected ? (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Not connected
              </span>
            )}
          </Badge>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Granted scopes</h2>
          <p className="text-xs text-muted-foreground mt-1">
            To change these scopes, disconnect and reconnect Google.
          </p>
        </div>
        <div className="space-y-2">
          <ScopeRow granted={hasGmail} icon={<Mail className="w-4 h-4" />} label="Gmail" description="Read, compose, send" />
          <ScopeRow granted={hasDrive} icon={<Drive className="w-4 h-4" />} label="Google Drive" description="Read, write files" />
          <ScopeRow granted={hasCalendar} icon={<Calendar className="w-4 h-4" />} label="Google Calendar" description="Read, write events" />
          <ScopeRow granted={hasSheets} icon={<Sheet className="w-4 h-4" />} label="Google Sheets" description="Read, write spreadsheets" />
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div>
          <h2 className="font-semibold text-sm">Connected Drive folders</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Folders NeureCore has provisioned in your Drive.
          </p>
        </div>
        {!rootFolderId ? (
          <p className="text-sm text-muted-foreground">
            Drive folders will appear here once an agent uses Documents or Reports.
          </p>
        ) : (
          <div className="space-y-1">
            {folders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Root folder is empty.</p>
            ) : (
              folders.map((f) => (
                <FolderRow key={f.id} folder={f} depth={0} />
              ))
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 border-destructive/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="font-semibold text-sm">Disconnect Google</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Agents will lose access to Gmail, Drive, Calendar, and Sheets.
              Existing files in Drive remain untouched.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => setConfirmDisconnect(true)}
              disabled={!status?.connected || actionLoading}
            >
              <Unlink className="w-4 h-4 mr-1" /> Disconnect Google
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Google Workspace?</DialogTitle>
            <DialogDescription>
              This will revoke our access to your Google account. You can reconnect anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDisconnect(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={actionLoading}>
              {actionLoading && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Yes, disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScopeRow({ granted, icon, label, description }: { granted: boolean; icon: React.ReactNode; label: string; description: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
      <div className="w-5 flex justify-center">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {granted ? (
        <Badge variant="default" className="text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Granted
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-xs">
          Not granted
        </Badge>
      )}
    </div>
  );
}

function FolderRow({ folder, depth }: { folder: DriveFolder; depth: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = folder.children && folder.children.length > 0;
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 text-sm hover:bg-muted/50 rounded px-1 cursor-pointer"
        style={{ paddingLeft: depth * 16 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Folder className="w-3.5 h-3.5 text-muted-foreground" />
        <span>{folder.name}</span>
        {hasChildren && (
          <span className="text-xs text-muted-foreground">({folder.children.length})</span>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {folder.children.map((c) => (
            <FolderRow key={c.id} folder={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManageGooglePage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    }>
      <ManageGoogleContent />
    </Suspense>
  );
}