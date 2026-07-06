import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab = params.tab;

  if (tab === 'ai') {
    redirect("/intelligence?tab=settings&aiTab=routing");
  }

  redirect("/intelligence?tab=settings");
}
