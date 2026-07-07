import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

const VALID_SUB_TABS = ['profile', 'ai', 'apikeys', 'security'] as const;

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab;

  if (tab === 'ai') {
    redirect("/intelligence?tab=settings&aiTab=routing");
  }

  if (tab && VALID_SUB_TABS.includes(tab as (typeof VALID_SUB_TABS)[number])) {
    redirect(`/intelligence?tab=settings&settingsSub=${tab}`);
  }

  redirect("/intelligence?tab=settings");
}
