import { redirect } from 'next/navigation';
import { readAuthConfig } from '../../auth/config';
import OverviewPage from '../../shell/overview-page';
export default function HomePage() {
  if (readAuthConfig().mode === 'mock') return <OverviewPage />;
  redirect('/home');
}
