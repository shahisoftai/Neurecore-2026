"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to AI settings by default
    router.replace("/settings/ai");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-zinc-500">Loading settings...</div>
    </div>
  );
}
