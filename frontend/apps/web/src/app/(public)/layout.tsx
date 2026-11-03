import type { ReactNode } from 'react';
import { AuthFrame } from '../../auth/frame';

export default function PublicLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AuthFrame>{children}</AuthFrame>;
}
