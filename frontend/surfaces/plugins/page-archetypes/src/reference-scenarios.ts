export type ReferenceStatus = 'healthy' | 'attention' | 'paused';
export type ReferenceRisk = 'low' | 'medium' | 'high';

export type ReferenceRecord = Readonly<{
  id: string;
  name: string;
  owner: string;
  region: 'apac' | 'emea' | 'americas';
  status: ReferenceStatus;
  risk: ReferenceRisk;
  updatedAt: string;
  completionPercent: number;
  description: string;
}>;

export type ReferenceFilters = Readonly<{
  query: string;
  status: ReferenceStatus | 'all';
  region: ReferenceRecord['region'] | 'all';
}>;

const names = [
  'North Star analytics',
  'Partner onboarding',
  'Trust review pipeline',
  'Regional release readiness',
  'Creator support operations',
  'Moderation quality signals',
  'Billing reconciliation',
  'Content lifecycle governance',
] as const;
const owners = ['Lin Chen', 'Avery Morgan', 'Mika Sato', 'Sam Rivera'] as const;
const regions = ['apac', 'emea', 'americas'] as const;
const statuses = ['healthy', 'attention', 'paused'] as const;
const risks = ['low', 'medium', 'high'] as const;

const referenceRecords: readonly ReferenceRecord[] = Array.from({ length: 48 }, (_, index) => {
  const sequence = index + 1;
  const name = names[index % names.length] ?? names[0];
  return {
    id: `REF-${String(sequence).padStart(3, '0')}`,
    name: `${name} ${sequence}`,
    owner: owners[index % owners.length] ?? owners[0],
    region: regions[index % regions.length] ?? regions[0],
    status: statuses[index % statuses.length] ?? statuses[0],
    risk: risks[(index + 1) % risks.length] ?? risks[0],
    updatedAt: new Date(Date.UTC(2026, 7, 29 - (index % 12), 8, 15)).toISOString(),
    completionPercent: 35 + ((index * 13) % 64),
    description:
      'Reference-only scenario data used to test long content, state composition, responsive layouts, and browser-host behavior without a backend dependency.',
  };
});

export function getReferenceRecords(): readonly ReferenceRecord[] {
  return referenceRecords;
}

export function filterReferenceRecords(
  records: readonly ReferenceRecord[],
  filters: ReferenceFilters,
): readonly ReferenceRecord[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase();
  return records.filter((record) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [record.id, record.name, record.owner].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      );
    return (
      matchesQuery &&
      (filters.status === 'all' || record.status === filters.status) &&
      (filters.region === 'all' || record.region === filters.region)
    );
  });
}

export function createReferenceSnapshot(records: readonly ReferenceRecord[]): string {
  return JSON.stringify(
    { generatedAt: '2026-08-29T00:00:00.000Z', recordCount: records.length, records },
    null,
    2,
  );
}
