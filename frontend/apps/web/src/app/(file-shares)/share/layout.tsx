import type { ReactNode } from 'react';
import { PublicFilesRuntime } from '../../../files/public-runtime';

export default function ShareLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PublicFilesRuntime>{children}</PublicFilesRuntime>;
}
