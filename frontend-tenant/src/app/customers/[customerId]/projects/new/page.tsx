'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import TenantShell from '@/components/TenantShell';
import { GlassPanel } from '@/components/home/GlassPanel';
import { Modal } from '@/components/creatio/Modal';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { customersService } from '@/services/customers.service';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import type { Customer } from '@/types/customers.types';

export default function NewCustomerProjectPage() {
  const user = useTenantAuth()!;
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = params.customerId;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await customersService.get(customerId);
      setCustomer(c);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !customer) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">Loading…</div>
      </TenantShell>
    );
  }

  if (!customer) {
    return (
      <TenantShell user={user}>
        <div className="p-12 text-center text-sm text-zinc-500">
          Customer not found.{' '}
          <Link href="/customers" className="text-primary hover:underline">
            Back to list
          </Link>
        </div>
      </TenantShell>
    );
  }

  return (
    <TenantShell user={user}>
      <div className="px-6 py-6 flex flex-col gap-6 max-w-2xl mx-auto w-full">
        <Link
          href={`/customers/${customerId}`}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to {customer.name}
        </Link>

        <GlassPanel className="p-6">
          <h1 className="text-xl font-bold text-zinc-100 mb-1">New Project</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Create a project for {customer.name}
          </p>
          <CreateProjectForm
            customerId={customerId}
            onClose={() => router.push(`/customers/${customerId}`)}
            onCreated={(id) => router.push(`/departments?tab=projects&projectId=${id}`)}
          />
        </GlassPanel>
      </div>
    </TenantShell>
  );
}
