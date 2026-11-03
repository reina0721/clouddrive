'use client';
import { useSearchParams } from 'next/navigation';
import { UserDetailPage } from '../../src/user-detail-page';
export default function UserDetailRoute() {
  return <UserDetailPage id={useSearchParams().get('id')} />;
}
