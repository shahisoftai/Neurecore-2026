import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Strategy Room | NeureCore Admin',
  description: 'Forecast platform financials under custom growth scenarios',
};

export default function StrategyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
