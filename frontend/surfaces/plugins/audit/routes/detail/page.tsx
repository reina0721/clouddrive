'use client';
import { useSearchParams } from 'next/navigation';
import { AuditDetailPage } from '../../src/audit-detail-page';
export default function AuditDetailRoute() {
  const params = useSearchParams();
  const backQuery = Object.fromEntries(
    Array.from(params.entries()).filter(([key]) =>
      ['q', 'actor', 'object', 'from', 'to', 'operation', 'result', 'page', 'pageSize'].includes(
        key,
      ),
    ),
  );
  return <AuditDetailPage id={params.get('id')} backQuery={backQuery} />;
}
