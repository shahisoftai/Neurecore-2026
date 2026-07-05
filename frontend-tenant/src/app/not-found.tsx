import Link from 'next/link';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="max-w-md w-full mx-4 p-8 rounded-xl border border-surface-border bg-surface-raised text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800">
          <FileQuestion className="w-8 h-8 text-zinc-400" />
        </div>
        <h2 className="text-xl font-semibold text-zinc-100 mb-2">
          Page not found
        </h2>
        <p className="text-zinc-400 text-sm mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/command-center"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Command Center
        </Link>
      </div>
    </div>
  );
}
