import { redirect } from "next/navigation";

// Legacy route — redirects to the new canonical URL.
// Phase 11 will remove this file entirely (after 30 days of zero direct traffic).
export default function Page() {
  redirect("/marketplace?tab=agents");
}
