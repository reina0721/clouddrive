'use client';
import { useSearchParams } from 'next/navigation';
import { RoleDetailPage } from '../../src/role-detail-page';
export default function RoleDetailRoute() {
  return <RoleDetailPage id={useSearchParams().get('id')} />;
}
