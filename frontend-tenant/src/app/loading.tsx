import { Loader2 } from 'lucide-react';

export default function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    </div>
  );
}
