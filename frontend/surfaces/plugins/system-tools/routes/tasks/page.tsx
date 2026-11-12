'use client';
import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackendOnly } from '../../../../src/administration/resource-state';
import { adminTaskQueryHref, readAdminTaskQuery } from '../../src/admin-task-query';
import { AdminTasksPage } from '../../src/admin-tasks-page';

function TaskRouteContent() {
  const params = useSearchParams().toString();
  const router = useRouter();
  const query = useMemo(() => readAdminTaskQuery(new URLSearchParams(params)), [params]);
  return (
    <AdminTasksPage
      key={params}
      query={query}
      navigate={(next) => router.push(adminTaskQueryHref(next), { scroll: false })}
    />
  );
}

export default function Route() {
  return (
    <BackendOnly>
      <Suspense>
        <TaskRouteContent />
      </Suspense>
    </BackendOnly>
  );
}
